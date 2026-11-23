# xmobot_viz

[Open the interactive configurator](https://yeatswang.github.io/xmobot_viz/) · [Xmobot ROS model](https://github.com/YeatsWang/xmobot)

Xmobot is a configurable, extensible mobile robot model. X stands for its many possible configurations. Mobot stands for mobile robot. Use the motion comparison to explore four-wheel independent steering and driving (4WISD), then switch to Mechanical layout to build and export your own Xmobot.

| Compare with | Motion | What to watch |
| --- | --- | --- |
| Differential | [Pivot](https://yeatswang.github.io/xmobot_viz/#pivot) | Tangential steering on 4WISD and opposite left/right speeds on the differential chassis |
| Mecanum | [Sideways](https://yeatswang.github.io/xmobot_viz/#lateral) · [Diagonal](https://yeatswang.github.io/xmobot_viz/#diagonal) | Parallel steering on 4WISD and diagonal wheel-speed combinations on Mecanum |
| Front Ackermann | [Turn](https://yeatswang.github.io/xmobot_viz/#ackermann) | 4WISD counter-steers its rear wheels. Ackermann holds them straight. Forward body speed and yaw rate match, while the chassis centres follow different arcs. |

## Configure and export

1. Open **Mechanical layout / 机械配置**. Choose a chassis profile or adjust body dimensions, wheel diameter, width, wheelbase and track. The left panel shows the standard chassis at the same scale.
2. Choose zero, one or two arms. By default the single mount is halfway between the central LiDAR and the rear edge. The controls use millimetres relative to the chassis centre, positive toward the camera. The slider limits keep the circular arm bases on the deck and clear of the LiDAR. Dual arms share one fore/aft offset and an adjustable centre spacing.
3. Select a drivetrain and click **Export Xmobot URDF**. Mechanical layout previews any of the four drivetrains. In a paired comparison the selector offers the two models on screen. Exports include collision geometry, inertia, joints, transmissions and the Gazebo tags from Xmobot. The browser works locally too: clone the repository and open `index.html`. No upload or build step is needed.

The motion panels show ideal kinematics. The exported Mecanum model uses cylindrical wheel collisions from the ROS package. Physical strafing requires a roller contact model or a dedicated controller. The downloadable URDF describes the robot at its joint origins. The ground, floating base and test wheel commands are supplied by the simulator.

## Rebuild and check

Run from this repository, with the [model repository](https://github.com/YeatsWang/xmobot) checked out at the revision linked in the viewer footer. Install Python packages `xacro` and `pyyaml` to regenerate the bundled assets.

```sh
python tools/build_assets.py ../xmobot assets
```

The release check downloads 17 URDFs from the page, covering four drivetrains, all three arm counts and edge cases for chassis dimensions and mount placement. Each export is compared with a fresh Xacro expansion. MuJoCo 3.17.0 then imports the file, adds a floating base and floor, and checks four-wheel ground contact and forward travel over two simulated seconds. This test exercises model import and contact dynamics. ROS controllers and the three browser trajectories have separate validation requirements.

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node test/motion.cjs
node test/downloads.cjs
python -m pip install mujoco==3.17.0 numpy xacro pyyaml
python test/check_simulation.py cases ../xmobot
```

MIT. See [project license](LICENSE) and [bundled third-party notices](assets/licenses.txt).
