"""Rebuild browser assets from an xmobot source checkout (requires xacro)."""
import argparse
import json
from pathlib import Path
from xml.etree import ElementTree as ET

import xacro


def vector(element, key):
    return [float(v) for v in (element.get(key, "0 0 0") if element is not None else "0 0 0").split()]


def visual_model(robot):
    links = {}
    for link in robot.findall("link"):
        visuals = []
        for visual in link.findall("visual"):
            shape = visual.find("geometry")[0]
            origin = visual.find("origin")
            dims = vector(shape, "size") if shape.tag == "box" else [
                float(shape.attrib[key]) for key in ("radius", "length") if key in shape.attrib
            ]
            visuals.append(dict(shape=shape.tag, dims=dims, xyz=vector(origin, "xyz"), rpy=vector(origin, "rpy")))
        links[link.attrib["name"]] = visuals
    joints = [dict(name=j.attrib["name"], parent=j.find("parent").attrib["link"],
                   child=j.find("child").attrib["link"], xyz=vector(j.find("origin"), "xyz"),
                   rpy=vector(j.find("origin"), "rpy"), axis=vector(j.find("axis"), "xyz"))
              for j in robot.findall("joint")]
    return dict(links=links, joints=joints)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("assets", type=Path)
    args = parser.parse_args()
    models, templates = {}, {}
    for drive in ("4wis", "diff_drive", "mecanum", "ackermann_front", "ackermann_rear"):
        templates[drive] = []
        for count in range(3):
            doc = xacro.process_file(str(args.source / "urdf/xmobot.urdf.xacro"),
                                     mappings={"arm_count": str(count), "drive_type": drive})
            robot = ET.fromstring(doc.toxml())
            ET.indent(robot)
            templates[drive].append(ET.tostring(robot, encoding="unicode"))
        models[drive] = visual_model(robot)
    for name, variable, data in [("models", "MODELS", models), ("templates", "URDFS", templates)]:
        (args.assets / (name + ".js")).write_text(
            "window.XMOBOT_" + variable + " = " + json.dumps(data, separators=(",", ":")) + ";\n"
        )


if __name__ == "__main__":
    main()
