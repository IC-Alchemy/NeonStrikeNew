"""Serve NeonStrike on port 80 and advertise it as http://emma.local/."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
import socket

try:
    from zeroconf import IPVersion, ServiceInfo, Zeroconf
except ModuleNotFoundError as exc:
    raise SystemExit("Install the LAN discovery helper first: py -m pip install zeroconf") from exc


PORT = 80
HOSTNAME = "emma.local."
SERVICE_NAME = "Emma NeonStrike._http._tcp.local."


class DevHandler(SimpleHTTPRequestHandler):
    """Serve current files without browser cache reuse during development."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


class ReusableHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def detect_lan_ip():
    """Select the local address used to reach the LAN without sending traffic."""
    override = os.environ.get("NEONSTRIKE_LAN_IP")
    if override:
        return override

    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("192.0.2.1", 80))
        return probe.getsockname()[0]
    finally:
        probe.close()


lan_ip = detect_lan_ip()
zeroconf = Zeroconf(ip_version=IPVersion.V4Only)
service = ServiceInfo(
    type_="_http._tcp.local.",
    name=SERVICE_NAME,
    server=HOSTNAME,
    addresses=[socket.inet_aton(lan_ip)],
    port=PORT,
    properties={"path": "/"},
)
zeroconf.register_service(service)
server = ReusableHTTPServer(("0.0.0.0", PORT), DevHandler)

try:
    print(f"Serving NeonStrike at http://emma.local/ ({lan_ip}:{PORT})")
    print("Press Ctrl+C to stop.")
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
    zeroconf.unregister_service(service)
    zeroconf.close()
