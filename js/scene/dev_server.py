from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from zeroconf import IPVersion, ServiceInfo, Zeroconf
import socket

PORT = 80
LAN_IP = "192.168.1.110"  # Replace with this computer's LAN IP

class DevHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

zeroconf = Zeroconf(ip_version=IPVersion.V4Only)

service = ServiceInfo(
    type_="_http._tcp.local.",
    name="Emma NeonStrike._http._tcp.local.",
    server="emma.local.",
    addresses=[socket.inet_aton(LAN_IP)],
    port=PORT,
    properties={"path": "/"},
)

zeroconf.register_service(service)

server = ThreadingHTTPServer(("0.0.0.0", PORT), DevHandler)

try:
    print(f"Serving at http://emma.local:{PORT}/")
    server.serve_forever()
finally:
    zeroconf.unregister_service(service)
    zeroconf.close()