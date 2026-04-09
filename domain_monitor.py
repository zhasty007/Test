#!/usr/bin/env python3
"""
Domain Expiration Monitor
Periodically checks WHOIS data for watched domains and alerts when expiration dates approach.

Usage:
    python domain_monitor.py                  # Run once then start scheduler
    python domain_monitor.py --check-once     # Run a single check and exit
    python domain_monitor.py --domain foo.com # Check a specific domain
"""

import argparse
import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import schedule
import whois

CONFIG_FILE = Path(__file__).parent / "domains.json"
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"

logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, datefmt="%Y-%m-%d %H:%M:%S")
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def load_config(path: Path = CONFIG_FILE) -> dict:
    with open(path) as f:
        config = json.load(f)

    if not isinstance(config.get("domains"), list) or not config["domains"]:
        raise ValueError("Config must contain a non-empty 'domains' list.")

    config.setdefault("alert_thresholds_days", [90, 60, 30, 14, 7])
    config.setdefault("check_interval_hours", 24)
    return config


# ---------------------------------------------------------------------------
# WHOIS lookup
# ---------------------------------------------------------------------------

def get_expiration_date(domain: str) -> Optional[datetime]:
    """Return the expiration date for *domain*, or None if unavailable."""
    try:
        data = whois.whois(domain)
    except Exception as exc:
        log.warning("WHOIS query failed for %s: %s", domain, exc)
        return None

    exp = data.expiration_date
    if exp is None:
        log.warning("No expiration date found in WHOIS record for %s", domain)
        return None

    # python-whois sometimes returns a list (multiple registrars)
    if isinstance(exp, list):
        exp = exp[0]

    # Ensure timezone-aware datetime for safe arithmetic
    if isinstance(exp, datetime):
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp

    return None


# ---------------------------------------------------------------------------
# Alerting
# ---------------------------------------------------------------------------

def days_until(dt: datetime) -> int:
    now = datetime.now(timezone.utc)
    return (dt - now).days


def build_alert_message(domain: str, expiry: datetime, days_left: int) -> str:
    urgency = "CRITICAL" if days_left <= 14 else "WARNING"
    return (
        f"[{urgency}] Domain '{domain}' expires in {days_left} day(s) "
        f"(on {expiry.strftime('%Y-%m-%d')})"
    )


def send_alert(message: str) -> None:
    """
    Emit an alert. Extend this function to send emails, Slack messages,
    PagerDuty events, etc.
    """
    # Printed at WARNING level so it stands out in logs
    log.warning(message)

    # -----------------------------------------------------------------------
    # Example: send an email via smtplib
    # -----------------------------------------------------------------------
    # import smtplib
    # from email.message import EmailMessage
    # msg = EmailMessage()
    # msg["Subject"] = message
    # msg["From"] = "monitor@example.com"
    # msg["To"] = "ops@example.com"
    # msg.set_content(message)
    # with smtplib.SMTP("localhost") as smtp:
    #     smtp.send_message(msg)
    #
    # -----------------------------------------------------------------------
    # Example: post to a Slack webhook
    # -----------------------------------------------------------------------
    # import urllib.request, json as _json
    # payload = _json.dumps({"text": message}).encode()
    # req = urllib.request.Request(
    #     "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    #     data=payload,
    #     headers={"Content-Type": "application/json"},
    # )
    # urllib.request.urlopen(req)


# ---------------------------------------------------------------------------
# Core check logic
# ---------------------------------------------------------------------------

def check_domain(domain: str, thresholds: list[int]) -> None:
    log.info("Checking %s ...", domain)
    expiry = get_expiration_date(domain)

    if expiry is None:
        return

    days_left = days_until(expiry)

    if days_left < 0:
        send_alert(
            f"[EXPIRED] Domain '{domain}' expired "
            f"{abs(days_left)} day(s) ago (on {expiry.strftime('%Y-%m-%d')})"
        )
        return

    log.info("  %s → expires %s (%d days)", domain, expiry.strftime("%Y-%m-%d"), days_left)

    for threshold in sorted(thresholds, reverse=True):
        if days_left <= threshold:
            send_alert(build_alert_message(domain, expiry, days_left))
            break  # fire the most-specific alert only


def check_all(config: dict) -> None:
    log.info("=== Starting domain expiration check ===")
    thresholds = config["alert_thresholds_days"]
    for domain in config["domains"]:
        check_domain(domain.strip().lower(), thresholds)
    log.info("=== Check complete ===")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Domain expiration monitor")
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--check-once",
        action="store_true",
        help="Run a single check pass and exit (no scheduler)",
    )
    group.add_argument(
        "--domain",
        metavar="DOMAIN",
        help="Check a single domain and exit",
    )
    parser.add_argument(
        "--config",
        metavar="FILE",
        default=str(CONFIG_FILE),
        help=f"Path to config file (default: {CONFIG_FILE})",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    try:
        config = load_config(Path(args.config))
    except (FileNotFoundError, ValueError) as exc:
        log.error("Config error: %s", exc)
        sys.exit(1)

    # -- Single-domain mode --------------------------------------------------
    if args.domain:
        check_domain(args.domain.strip().lower(), config["alert_thresholds_days"])
        return

    # -- One-shot mode -------------------------------------------------------
    if args.check_once:
        check_all(config)
        return

    # -- Scheduler mode ------------------------------------------------------
    interval_hours = config["check_interval_hours"]
    log.info("Scheduler starting — checking every %d hour(s).", interval_hours)

    # Run immediately on startup, then on schedule
    check_all(config)
    schedule.every(interval_hours).hours.do(check_all, config=config)

    while True:
        schedule.run_pending()
        time.sleep(60)  # wake up every minute to check the schedule


if __name__ == "__main__":
    main()
