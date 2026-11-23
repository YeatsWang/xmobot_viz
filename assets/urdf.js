// The templates retain the links, transmissions, sensors and Gazebo tags emitted by Xacro.
function downloadUrdf(hardware) {
  const {state, mounts, corners} = viewer;
  const {dims: d, arms} = state;
  const mount = mounts(d, arms);
  const robot = new DOMParser().parseFromString(XMOBOT_URDFS[hardware][arms], 'application/xml');
  const nodes = new Map(Array.from(robot.documentElement.children, el =>
    [el.tagName + ':' + el.getAttribute('name'), el]));
  function origin(joint, xyz) {
    nodes.get('joint:' + joint).querySelector('origin').setAttribute('xyz', xyz.join(' '));
  }
  function inertia(link, xx, yy, zz) {
    const tensor = link.querySelector('inertial > inertia');
    for (const [name, value] of Object.entries({ixx: xx, iyy: yy, izz: zz})) {
      tensor.setAttribute(name, value + .001);
    }
  }
  const base = nodes.get('link:base_link');
  for (const box of base.querySelectorAll('geometry > box')) {
    box.setAttribute('size', [d.length, d.width, d.height].join(' '));
  }
  inertia(base, (d.width**2 + d.height**2)/6, (d.length**2 + d.height**2)/6,
    (d.length**2 + d.width**2)/6);
  origin('base_joint', [0, 0, mount.body]);
  origin('camera_joint', [mount.camera, 0, 0]);
  origin('lidar_joint', [0, 0, d.height/2 + .025]);
  if (arms) origin('left_joint_1', [mount.armX, arms === 2 ? mount.dualY : 0, d.height/2]);
  if (arms === 2) origin('right_joint_1', [mount.armX, -mount.dualY, d.height/2]);

  const positions = corners(d);
  for (const [i, name] of ['front_left','front_right','rear_left','rear_right'].entries()) {
    const xy = positions[i], wheel = nodes.get('link:' + name + '_wheel_link');
    const steer = name + '_steering_joint';
    if (nodes.has('joint:' + steer)) {
      origin(steer, [...xy, mount.steer]);
      origin(name + '_wheel_joint', [0, 0, mount.axle]);
    } else {
      origin(name + '_wheel_joint', [...xy, d.radius - mount.body]);
    }
    for (const cylinder of wheel.querySelectorAll('geometry > cylinder')) {
      cylinder.setAttribute('length', d.wheelWidth);
      cylinder.setAttribute('radius', d.radius);
    }
    const transverse = (3*d.radius**2 + d.wheelWidth**2)/12;
    inertia(wheel, transverse, transverse, d.radius**2/2);
  }
  const xml = '<?xml version="1.0"?>\n' + new XMLSerializer().serializeToString(robot) + '\n';
  const url = URL.createObjectURL(new Blob([xml], {type:'application/xml'}));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'xmobot-' + hardware + '-' + arms + 'arm.urdf';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
