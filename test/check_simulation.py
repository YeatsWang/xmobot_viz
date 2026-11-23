"""Check downloaded URDFs against Xacro and run a floating-base floor test."""
import argparse
import json
from pathlib import Path
from xml.etree import ElementTree as ET

import mujoco as mj
import numpy as np
import xacro


def equivalent(a, b, path="robot"):
    assert (a.tag, a.attrib.keys(), len(a)) == (b.tag, b.attrib.keys(), len(b)), path
    for key, v in list(a.attrib.items()) + [("text()", (a.text or "").strip())]:
        w = b.attrib[key] if key in b.attrib else (b.text or "").strip()
        if v == w:
            continue
        va, vb = [float(n) for n in v.split()], [float(n) for n in w.split()]
        assert len(va) == len(vb) and np.allclose(va, vb, rtol=1e-9, atol=1e-10), (path, key, v, w)
    for c, d in zip(a, b):
        equivalent(c, d, path + "/" + c.get("name", c.tag))


def check(directory, source, case):
    dims, arm = case["dims"], case["arms"]
    fields = dict(length="robot_length", width="robot_width", height="robot_height", radius="wheel_radius",
                  wheelWidth="wheel_width", wheelbase="wheel_separation_x", track="wheel_separation_y")
    params = {fields[k]: str(v) for k, v in dims.items()}
    params.update(drive_type=case["drive"], arm_count=str(arm))
    for arg, key in [("arm_mount_x", "singleX" if arm == 1 else "dualX"), ("arm_spacing", "spacing")]:
        if case[key] is not None:
            params[arg] = str(case[key])
    xml = xacro.process_file(str(source / "urdf/xmobot.urdf.xacro"), mappings=params)
    path = str(directory / case["file"])
    equivalent(ET.parse(path).getroot(), ET.fromstring(xml.toxml()))
    direct = mj.MjModel.from_xml_path(path)
    expect = 4 + {"4wis": 4, "ackermann_front": 2, "ackermann_rear": 2}.get(case["drive"], 0) + 8*arm
    assert direct.nq == expect, (case, direct.nq, expect)

    spec = mj.MjSpec.from_file(path)
    spec.body("base_footprint").add_freejoint()
    spec.worldbody.add_geom(name="floor", type=mj.mjtGeom.mjGEOM_PLANE, size=[5, 5, .05])
    model = spec.compile()
    model.opt.timestep = .001
    data = mj.MjData(model)
    data.qpos[2] = .015
    mj.mj_forward(model, data)
    wheel_ids = {model.body(b).id for b in ("front_left_wheel_link", "front_right_wheel_link",
                                            "rear_left_wheel_link", "rear_right_wheel_link")}
    floor = model.geom("floor").id
    # Hold arm and steer joints near their neutral positions during the drop.
    hinges = [model.joint(i) for i in range(model.njnt) if i and "wheel_joint" not in model.joint(i).name]
    wheels = [model.joint(i) for i in range(model.njnt) if "wheel_joint" in model.joint(i).name]
    contacts = set()
    for step in range(2000):
        for joint in hinges:
            q, v = joint.qposadr[0], joint.dofadr[0]
            data.qfrc_applied[v] = data.qfrc_bias[v] - 12*data.qpos[q] - 1.8*data.qvel[v]
        if step >= 1000:
            for joint in wheels:
                v = joint.dofadr[0]
                data.qfrc_applied[v] = np.clip(.3*(2-data.qvel[v]), -.4, .4)
        mj.mj_step(model, data)
        if 850 <= step < 1000:
            for contact in data.contact:
                a, b = contact.geom
                if floor in (a, b):
                    contacts.add(int(model.geom_bodyid[b if a == floor else a]))
    assert np.all(np.isfinite(data.qpos)) and not np.any(data.warning.number), data.warning.number
    assert wheel_ids <= contacts, (case["file"], "missing wheel contact", wheel_ids - contacts)
    assert data.qpos[0] > .025, (case["file"], "insufficient forward motion", data.qpos[:3])
    return round(float(data.qpos[0]), 3)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cases", type=Path)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    for case in json.loads((args.cases / "manifest.json").read_text()):
        distance = check(args.cases, args.source, case)
        print(case["file"], "passed; travel", distance, "m", flush=True)
