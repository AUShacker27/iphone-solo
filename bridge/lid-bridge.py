#!/usr/bin/env python3
"""Stream the MacBook lid angle to iPhone Solo.

Reads Apple's lid angle sensor over HID
and serves it as text/event-stream on 127.0.0.1:8471/lid.

    pip3 install hidapi
    python3 lid-bridge.py
"""

import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    import hid
except ImportError:
    sys.exit('hidapi is missing. Run: pip3 install hidapi')

PORT = 8471
VENDOR = 0x05AC
PRODUCT = 0x8104
USAGE_PAGE = 0x20
USAGE = 0x8A
RATE = 1 / 60


# Sensor
def open_sensor():
    for info in hid.enumerate(VENDOR, PRODUCT):
        if info['usage_page'] == USAGE_PAGE and info['usage'] == USAGE:
            device = hid.device()
            device.open_path(info['path'])
            return device
    sys.exit('No lid angle sensor found. It ships in MacBooks from 2019 on.')


sensor = open_sensor()
sensor_lock = threading.Lock()


def read_angle():
    with sensor_lock:
        report = sensor.get_feature_report(1, 8)
    return report[1] | (report[2] << 8)


# Server
class Handler(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Private-Network', 'true')

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def do_GET(self):
        if self.path != '/lid':
            self.send_error(404)
            return

        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.cors()
        self.end_headers()

        try:
            while True:
                self.wfile.write(f'data: {read_angle()}\n\n'.encode())
                self.wfile.flush()
                time.sleep(RATE)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, *args):
        pass


print(f'Lid at {read_angle()}°. Streaming on http://127.0.0.1:{PORT}/lid — press Ctrl+C to stop.')
try:
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
except KeyboardInterrupt:
    pass
