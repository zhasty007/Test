#!/usr/bin/env python3
"""
GoDaddy Domain Expiration Monitor
Uses the GoDaddy API to fetch expiration dates for domains in your account
and fires graduated alerts as those dates approach.

Credentials are read from environment variables (or a .env file):
    GODADDY_API_KEY    — your GoDaddy API key
    GODADDY_API_SECRET — your GoDaddy API secret

Get a key/secret pair at: https://developer.godaddy.com/keys

Usage:
    python godaddy_monitor.py                  # check all account domains, then schedule
    python godaddy_monitor.py --check-once     # single pass and exit
    python godaddy_monitor.py --domain foo.com # check one domain and exit
    python godaddy_monitor.py --list           # list all domains in the account and exit
    python godaddy_monitor.py --ote            # use the OTE (sandbox) environment
"""

import argparse
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests
import schedule
from dotenv import load_dotenv

load_dotenv()  # picks up .env in the working directory if present

LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, datefmt="%Y-%m-%d %H:%M:%S")
log = logging.getLogger(__name__)

PRODUCTION_URL = "https://api.godaddy.com"
OTE_URL = "https://api.ote-godaddy.com"

# Default alert thresholds (days before expiry)
DEFAULT_THRESHOLDS = [90, 60, 30, 14, 7]
DEFAULT_INTERVAL_HOURS = 24

# GoDaddy allows up to 60 req/min; back off when rate-limited
_MAX_RETRIES = 4
_INITIAL_BACKOFF = 2  # seconds


# ---------------------------------------------------------------------------
# GoDaddy API client
# ---------------------------------------------------------------------------

class GoDaddyClient:
    def __init__(self, api_key: str, api_secret: str, base_url: str = PRODUCTION_URL):
        self._base_url = base_url.rstrip("/")
        self._session = requests.Session()
        self._session.headers.update({
            "Authorization": f"sso-key {api_key}:{api_secret}",
            "Accept": "application/json",
        })

    def _get(self, path: str, params: Optional[dict] = None) -> dict | list:
        url = f"{self._base_url}{path}"
        backoff = _INITIAL_BACKOFF

        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                resp = self._session.get(url, params=params, timeout=30)
            except requests.RequestException as exc:
                if attempt == _MAX_RETRIES:
                    raise
                log.warning("Request failed (%s), retrying in %ds…", exc, backoff)
                time.sleep(backoff)
                backoff *= 2
                continue

            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", backoff))
                log.warning("Rate limited — waiting %ds before retry…", retry_after)
                time.sleep(retry_after)
                backoff *= 2
                continue

            resp.raise_for_status()
            return resp.json()

        raise RuntimeError(f"Failed to GET {url} after {_MAX_RETRIES} retries")

    def list_domains(self) -> list[dict]:
        """Return all domains in the account (handles pagination automatically)."""
        domains: list[dict] = []
        marker = None

        while True:
            params = {"limit": 1000}
            if marker:
                params["marker"] = marker

            page = self._get("/v1/domains", params=params)
            if not page:
                break

            domains.extend(page)

            # GoDaddy paginates via the last domain name returned
            if len(page) < 1000:
                break
            marker = page[-1]["domain"]

        return domains

    def get_domain(self, domain: str) -> dict:
        """Return details for a single domain."""
        return self._get(f"/v1/domains/{domain}")


# ---------------------------------------------------------------------------
# Expiry helpers
# ---------------------------------------------------------------------------

def parse_expiry(raw: Optional[str]) -> Optional[datetime]:
    """Parse an ISO 8601 expiration string into a timezone-aware datetime."""
    if not raw:
        return None
    try:
        # Python 3.11+ handles 'Z' natively; fromisoformat chokes on it earlier
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        log.warning("Could not parse expiration date: %r", raw)
        return None


def days_until(dt: datetime) -> int:
    return (dt - datetime.now(timezone.utc)).days


# ---------------------------------------------------------------------------
# Alerting
# ---------------------------------------------------------------------------

def send_alert(message: str) -> None:
    """
    Emit an alert. Extend this to send emails, Slack messages, PagerDuty
    events, etc. See domain_monitor.py for commented-out examples.
    """
    log.warning(message)

    # -----------------------------------------------------------------------
    # Example: Slack webhook
    # -----------------------------------------------------------------------
    # import json as _json, urllib.request
    # payload = _json.dumps({"text": message}).encode()
    # req = urllib.request.Request(
    #     os.environ["SLACK_WEBHOOK_URL"],
    #     data=payload,
    #     headers={"Content-Type": "application/json"},
    # )
    # urllib.request.urlopen(req)
    #
    # -----------------------------------------------------------------------
    # Example: email via smtplib
    # -----------------------------------------------------------------------
    # import smtplib
    # from email.message import EmailMessage
    # msg = EmailMessage()
    # msg["Subject"] = message
    # msg["From"] = os.environ["ALERT_FROM"]
    # msg["To"] = os.environ["ALERT_TO"]
    # msg.set_content(message)
    # with smtplib.SMTP(os.environ.get("SMTP_HOST", "localhost")) as smtp:
    #     smtp.send_message(msg)


def evaluate_domain(name: str, expiry: datetime, thresholds: list[int]) -> None:
    days_left = days_until(expiry)
    expiry_str = expiry.strftime("%Y-%m-%d")

    if days_left < 0:
        send_alert(
            f"[EXPIRED] '{name}' expired {abs(days_left)} day(s) ago (on {expiry_str})"
        )
        return

    log.info("  %-40s expires %s (%d days)", name, expiry_str, days_left)

    for threshold in sorted(thresholds, reverse=True):
        if days_left <= threshold:
            urgency = "CRITICAL" if days_left <= 14 else "WARNING"
            send_alert(
                f"[{urgency}] '{name}' expires in {days_left} day(s) (on {expiry_str})"
            )
            break


# ---------------------------------------------------------------------------
# Check routines
# ---------------------------------------------------------------------------

def check_all_account_domains(client: GoDaddyClient, thresholds: list[int]) -> None:
    log.info("=== Fetching all domains from GoDaddy account ===")
    try:
        domains = client.list_domains()
    except Exception as exc:
        log.error("Failed to list domains: %s", exc)
        return

    log.info("Found %d domain(s).", len(domains))
    for record in domains:
        name = record.get("domain", "unknown")
        expiry = parse_expiry(record.get("expirationDate") or record.get("expires"))
        if expiry is None:
            log.warning("No expiration date for %s — skipping", name)
            continue
        evaluate_domain(name, expiry, thresholds)

    log.info("=== Check complete ===")


def check_single_domain(client: GoDaddyClient, domain: str, thresholds: list[int]) -> None:
    log.info("Checking %s …", domain)
    try:
        record = client.get_domain(domain)
    except requests.HTTPError as exc:
        if exc.response is not None and exc.response.status_code == 404:
            log.error("Domain '%s' not found in your GoDaddy account.", domain)
        else:
            log.error("API error for %s: %s", domain, exc)
        return
    except Exception as exc:
        log.error("Failed to query %s: %s", domain, exc)
        return

    expiry = parse_expiry(record.get("expirationDate") or record.get("expires"))
    if expiry is None:
        log.warning("No expiration date returned for %s", domain)
        return

    evaluate_domain(domain, expiry, thresholds)


def check_specific_domains(
    client: GoDaddyClient, domains: list[str], thresholds: list[int]
) -> None:
    log.info("=== Checking %d configured domain(s) ===", len(domains))
    for domain in domains:
        check_single_domain(client, domain.strip().lower(), thresholds)
    log.info("=== Check complete ===")


# ---------------------------------------------------------------------------
# Scheduler wrapper
# ---------------------------------------------------------------------------

def scheduled_check(client: GoDaddyClient, domains: list[str], thresholds: list[int]) -> None:
    if domains:
        check_specific_domains(client, domains, thresholds)
    else:
        check_all_account_domains(client, thresholds)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="GoDaddy domain expiration monitor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--check-once",
        action="store_true",
        help="Run a single check pass and exit",
    )
    mode.add_argument(
        "--domain",
        metavar="DOMAIN",
        help="Check a single domain and exit",
    )
    mode.add_argument(
        "--list",
        action="store_true",
        help="Print all domains in the account with their expiry dates and exit",
    )
    parser.add_argument(
        "--domains",
        metavar="d1,d2",
        help="Comma-separated list of domains to watch (default: all account domains)",
    )
    parser.add_argument(
        "--thresholds",
        metavar="DAYS",
        default=",".join(str(d) for d in DEFAULT_THRESHOLDS),
        help=f"Comma-separated alert thresholds in days (default: {DEFAULT_THRESHOLDS})",
    )
    parser.add_argument(
        "--interval",
        metavar="HOURS",
        type=int,
        default=DEFAULT_INTERVAL_HOURS,
        help=f"Check interval in hours for scheduler mode (default: {DEFAULT_INTERVAL_HOURS})",
    )
    parser.add_argument(
        "--ote",
        action="store_true",
        help="Use the GoDaddy OTE (sandbox) environment instead of production",
    )
    return parser.parse_args()


def load_credentials() -> tuple[str, str]:
    api_key = os.environ.get("GODADDY_API_KEY", "").strip()
    api_secret = os.environ.get("GODADDY_API_SECRET", "").strip()
    if not api_key or not api_secret:
        log.error(
            "GODADDY_API_KEY and GODADDY_API_SECRET must be set "
            "(via environment variables or a .env file)."
        )
        sys.exit(1)
    return api_key, api_secret


def main() -> None:
    args = parse_args()
    thresholds = [int(d.strip()) for d in args.thresholds.split(",")]
    domains = [d.strip() for d in args.domains.split(",")] if args.domains else []

    api_key, api_secret = load_credentials()
    base_url = OTE_URL if args.ote else PRODUCTION_URL
    client = GoDaddyClient(api_key, api_secret, base_url)

    if args.ote:
        log.info("Using OTE (sandbox) environment: %s", OTE_URL)

    # -- List mode -----------------------------------------------------------
    if args.list:
        records = client.list_domains()
        print(f"{'DOMAIN':<45} {'EXPIRES':<12}  STATUS")
        print("-" * 70)
        for r in sorted(records, key=lambda x: x.get("expirationDate") or ""):
            expiry = parse_expiry(r.get("expirationDate") or r.get("expires"))
            exp_str = expiry.strftime("%Y-%m-%d") if expiry else "unknown"
            days = f"({days_until(expiry)}d)" if expiry else ""
            print(f"{r['domain']:<45} {exp_str:<12} {days:>8}  {r.get('status', '')}")
        return

    # -- Single-domain mode --------------------------------------------------
    if args.domain:
        check_single_domain(client, args.domain.strip().lower(), thresholds)
        return

    # -- One-shot mode -------------------------------------------------------
    if args.check_once:
        scheduled_check(client, domains, thresholds)
        return

    # -- Scheduler mode ------------------------------------------------------
    log.info("Scheduler starting — checking every %d hour(s).", args.interval)
    scheduled_check(client, domains, thresholds)
    schedule.every(args.interval).hours.do(scheduled_check, client, domains, thresholds)

    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    main()
