"""Rebuild the standard 4WISD demonstration. Distances are metres, angles radians."""
import bisect
import json
import math
from pathlib import Path

FPS = 24
STEPS = 10
DT = 1 / (FPS * STEPS)
DURATION = 70
ARRIVAL = 62.0
PIVOT_START = 63.4
CORNERS = ((.25, .20), (.25, -.20), (-.25, .20), (-.25, -.20))
RADIUS = .08


def schedule(straight, lateral, spin):
    # Each pair brackets a steady body twist (forward, left, yaw rate).
    phases = [
        (0, 4.6, (straight, 0, 0)),
        (5.7, 12.45, (.49, 0, -.38)),
        (13.7, 20.4, (0, lateral, 0)),
        (21.7, 29.0, (.36, -.18, 0)),
        # For front steering vy = omega*L/2 keeps the rear wheels straight.
        (30.2, 40.8, (.44, -.30 * .25, -.30)),
        # For rear steering vy = -omega*L/2 keeps the front wheels straight.
        (42.2, 52.9, (.34, -.22 * .25, .22)),
        # Combined translation and rotation: forward travel and yaw continue while lateral speed
        # changes sign. Finish tangent to the chassis heading at the starting point.
        (54.15, 55.3, (.27, .17, .12)),
        (57.45, 58.55, (.27, -.17, .12)),
        (60.25, 60.6, (.24, 0, 0)),
        (ARRIVAL, PIVOT_START, (0, 0, 0)),
        (64.55, 67.9, (0, 0, spin)),
        (69.25, DURATION, (0, 0, 0)),
    ]
    return [(time, twist) for start, end, twist in phases for time in sorted({start, end})]


def blend(a, b, u):
    return tuple(i + (j - i) * u for i, j in zip(a, b))


def wheel_vectors(twist):
    vx, vy, yaw_rate = twist
    return [(vx - yaw_rate * y, vy + yaw_rate * x) for x, y in CORNERS]


def steering_clock(start, end):
    # Allocate blend time to steering travel, including passages near zero tyre speed.
    if not any(start) or not any(end):
        return [step / 300 for step in range(301)]
    clock = [0]
    previous = None
    for step in range(301):
        vectors = wheel_vectors(blend(start, end, step / 300))
        angles = [math.atan2(y, x) for x, y in vectors]
        if previous:
            travel = max(abs((a - b + math.pi / 2) % math.pi - math.pi / 2)
                         for a, b in zip(angles, previous))
            clock.append(clock[-1] + 1 / 300 + 6 * travel)
        previous = angles
    return [v / clock[-1] for v in clock]


REFERENCE = schedule(.38, .64, .70)
CLOCKS = [steering_clock(a, b) for (_, a), (_, b) in zip(REFERENCE, REFERENCE[1:])]


def simulate(straight, lateral, spin, record=False):
    keys = schedule(straight, lateral, spin)
    times = [key[0] for key in keys]

    def twist_at(time):
        i = max(0, min(len(times) - 2, bisect.bisect_right(times, time) - 1))
        u = (time - times[i]) / (times[i + 1] - times[i])
        u = u * u * (3 - 2 * u)
        clock = CLOCKS[i]
        j = max(0, min(299, bisect.bisect_right(clock, u) - 1))
        fraction = (j + (u - clock[j]) / (clock[j + 1] - clock[j])) / 300
        return blend(keys[i][1], keys[i + 1][1], fraction)

    x = y = yaw = 0.
    steer = [0.] * 4
    turns = [0.] * 4
    # With the chassis at the start point, align the stationary wheels once for
    # a centre pivot. Interpolating the headings here avoids a snap at zero speed.
    pivot_angles = [math.atan(dy / dx) for dx, dy in wheel_vectors((0, 0, 1))]
    frames = []
    for k in range(DURATION * FPS * STEPS + 1):
        t = k * DT
        if record:
            wheels = []
            for i, (dx, dy) in enumerate(wheel_vectors(twist_at(t))):
                if ARRIVAL <= t <= PIVOT_START:
                    u = (t - ARRIVAL) / (PIVOT_START - ARRIVAL)
                    steer[i] = pivot_angles[i] * u*u*(3-2*u)
                elif abs(dx) > 1e-8:
                    steer[i] = math.atan(dy / dx)
                elif abs(dy) > 1e-8:
                    steer[i] = math.copysign(math.pi / 2, steer[i])
                speed = dx * math.cos(steer[i]) + dy * math.sin(steer[i])
                wheels.extend((steer[i], speed, turns[i]))
            if k % STEPS == 0:
                frames.append([round(v, 5) for v in (x, y, yaw, *wheels)])
        if k == DURATION * FPS * STEPS:
            break
        twist = twist_at(t + DT / 2)
        vx, vy, omega = twist
        a = yaw + omega * DT / 2
        x += DT * (vx * math.cos(a) - vy * math.sin(a))
        y += DT * (vx * math.sin(a) + vy * math.cos(a))
        yaw += DT * omega
        if record:
            for i, (dx, dy) in enumerate(wheel_vectors(twist)):
                turns[i] += DT * (dx * math.cos(steer[i]) + dy * math.sin(steer[i])) / RADIUS
    return x, y, yaw, frames


def build():
    # Solve the two linear position constraints and the final heading constraint.
    x, y, h, _ = simulate(0, 0, 0)
    ax, ay, _, _ = simulate(1, 0, 0)
    bx, by, _, _ = simulate(0, 1, 0)
    _, _, h1, _ = simulate(0, 0, 1)
    ax, ay, bx, by = ax - x, ay - y, bx - x, by - y
    det = ax * by - ay * bx
    straight = (-x * by + y * bx) / det
    lateral = (-ax * y + ay * x) / det
    spin = -h / (h1 - h)
    x, y, yaw, frames = simulate(straight, lateral, spin, True)
    assert math.hypot(x, y) < 1e-6 and abs(yaw) < 1e-6
    data = ',\n'.join(json.dumps(row, separators=(',', ':')) for row in frames)
    target = Path(__file__).resolve().parents[1] / 'assets/route-data.js'
    target.write_text('// Generated by tools/build_route.py. Pose then (steering, speed, spin) for FL, FR, RL, RR.\n'
                      + f'window.XmobotRouteSamples = {{fps:{FPS}, rows:[\n{data}\n]}};\n')


if __name__ == '__main__':
    build()
