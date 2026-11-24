<p align="center"><img src="assets/xmobot-logo.png" alt="Xmobot" width="108"></p>

# xmobot_viz

[Open the interactive configurator](https://yeatswang.github.io/xmobot_viz/) · [Xmobot ROS model](https://github.com/YeatsWang/xmobot)

Xmobot is a configurable, extensible mobile robot model. X stands for its many possible configurations. Mobot stands for mobile robot. The viewer opens with a [70-second, 29.6 m classic circuit](https://yeatswang.github.io/xmobot_viz/#classic) driven by a four-wheel independent steering and driving (4WISD) configuration. Follow the robot through a sweeping right turn, leftward and diagonal travel, a front-Ackermann right turn, a rear-Ackermann left turn, a segment of combined translation and rotation, and a final pivot. The return follows a separate S-bend, leaving space between the outbound and inbound tracks. The default full-circuit view centres the ground on the four wheel paths with a one-metre margin on every side. Select **Follow robot / 跟随** to inspect steering and wheel rotation up close. The four wheel tracks stay on the ground when the robot returns to its starting pose. During [combined translation and rotation](https://yeatswang.github.io/xmobot_viz/#compound), the lateral velocity reverses while the chassis continues to yaw left. The body-frame diagram shows forward and lateral velocity in m/s and yaw rate in rad/s.

Choose **Motion comparison / 运动对比** to compare individual motions, or **Mechanical layout / 机械配置** to build and export your own Xmobot.

| Motion | Compare with | Wheel behaviour |
| --- | --- | --- |
| Pivot | [Differential](https://yeatswang.github.io/xmobot_viz/#pivot) · [Mecanum](https://yeatswang.github.io/xmobot_viz/#mecanum-pivot) | Four steered wheels follow tangents. Fixed wheels use opposing side speeds, with tyre scrub or angled rollers accommodating lateral wheel-centre velocity. |
| Translate | Mecanum · [Sideways](https://yeatswang.github.io/xmobot_viz/#lateral) · [Diagonal](https://yeatswang.github.io/xmobot_viz/#diagonal) | Parallel steering on 4WISD and diagonal wheel-speed combinations on Mecanum. |
| Turn | [Front Ackermann](https://yeatswang.github.io/xmobot_viz/#ackermann) · [Rear Ackermann](https://yeatswang.github.io/xmobot_viz/#rear-ackermann) | 4WISD counter-steers its axles. The reference steers one axle and holds the other straight. |

## Learn the kinematics

Open the [worked equations](https://yeatswang.github.io/xmobot_viz/#kinematics) beneath the motion viewer. Choose a wheel to follow the body twist through its wheel-centre velocity, steering angle and signed spin rate. Change the wheelbase, track or wheel radius in Mechanical layout to recalculate both sides.

The 4WISD equations draw on Yizhi Wang, Degang Xu and Yongfang Xie, “Universal Multi-Mode Kinematic Controller for Four-Wheel Independent Steering and Driving Mobile Robots,” CAC 2025, pp. 4491–4496. [IEEE Xplore](https://ieeexplore.ieee.org/document/11487174)

For the configurable platform in robotics education, see Yizhi Wang, Minjuan Wang, Degang Xu, John Chi-Kin Lee and Yongfang Xie, “Xmobot: Enabling Rapid Build-and-Train Robotics Education With Agentic AI,” IEEE Transactions on Learning Technologies, vol. 19, pp. 376–387, 2026. [IEEE Xplore](https://ieeexplore.ieee.org/document/11475163) · [BibTeX for both papers](xmobot.bib)

## Configure and export

1. Open **Mechanical layout / 机械配置**. Choose a chassis profile or adjust body dimensions, wheel diameter, width, wheelbase and track. The left panel shows the standard chassis at the same scale.
2. Choose zero, one or two arms. By default the single mount is halfway between the central LiDAR and the rear edge. The controls use millimetres relative to the chassis centre, positive toward the camera. The slider limits keep the circular arm bases on the deck and clear of the LiDAR. Dual arms share one fore/aft offset and an adjustable centre spacing.
3. Select a drivetrain and click **Export Xmobot URDF**. Mechanical layout previews any of the five drivetrains. In a paired comparison the selector offers the two models on screen. Exports include collision geometry, inertia, joints, transmissions and the Gazebo tags from Xmobot. The browser works locally too: clone the repository and open `index.html`. No upload or build step is needed.

The motion panels show ideal kinematics. The exported Mecanum model uses cylindrical wheel collisions from the ROS package. Physical strafing requires roller contacts or equivalent lateral forces. The downloadable URDF describes the robot at its joint origins. The ground, floating base and test wheel commands are supplied by the simulator.

## Rebuild and check

Run from this repository, with the [model repository](https://github.com/YeatsWang/xmobot) checked out at the revision linked in the viewer footer. Install Python packages `xacro` and `pyyaml` to regenerate the bundled assets.

```sh
python tools/build_assets.py ../xmobot assets
```

The release check downloads 20 URDFs from the page, covering five drivetrains, all three arm counts and edge cases for chassis dimensions and mount placement. Each export is compared with a fresh Xacro expansion. MuJoCo 3.17.0 then imports the file, adds a floating base and floor, and checks four-wheel ground contact and forward travel over two simulated seconds. This test exercises model import and contact dynamics. ROS controllers and the three browser trajectories have separate validation requirements.

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
python3 tools/build_route.py
node test/route.cjs
node test/motion.cjs
node test/downloads.cjs
python -m pip install mujoco==3.17.0 numpy xacro pyyaml
python test/check_simulation.py cases ../xmobot
```

MIT. See [project license](LICENSE) and [bundled third-party notices](assets/licenses.txt).
