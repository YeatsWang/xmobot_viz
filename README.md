# xmobot_viz

[Open the interactive configurator](https://yeatswang.github.io/xmobot_viz/) · [Xmobot ROS model](https://github.com/YeatsWang/xmobot)

Configure a four-wheel independent steering and driving (4WISD) robot in the browser and export its URDF. The two panels share a clock, scale and starting pose. Select a comparison to see the wheel angles and speeds for the same chassis motion.

| 4WISD motion | Compare with | What to watch |
| --- | --- | --- |
| [Pivot about the centre](https://yeatswang.github.io/xmobot_viz/#pivot) | Four-wheel differential | Tangential steering versus opposing left/right wheel speeds |
| [Translate sideways](https://yeatswang.github.io/xmobot_viz/#lateral) | Mecanum | Steering to 90° versus opposite diagonal wheel speeds |
| [Follow a turn](https://yeatswang.github.io/xmobot_viz/#ackermann) | Front-steered Ackermann | Inner and outer front angles with both rear wheels straight |

## Configure and export

1. Open **Mechanical layout / 机械配置**. Choose a chassis profile or adjust body dimensions, wheel diameter, width, wheelbase and track. The left panel shows the standard chassis at the same scale.
2. Choose zero, one or two arms. By default the single mount is halfway between the central LiDAR and the rear edge. The controls use millimetres relative to the chassis centre, positive toward the camera. The slider limits keep the circular arm bases on the deck and clear of the LiDAR. Dual arms share one fore/aft offset and an adjustable centre spacing.
3. Click **Download 4WISD URDF**. In motion comparisons, a second button downloads the reference chassis with the same dimensions and arm layout. Exports include collision geometry, inertia, joints, transmissions and the Gazebo tags from Xmobot. The browser works locally too: clone the repository and open `index.html`. No upload or build step is needed.

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
node test/downloads.cjs
python -m pip install mujoco==3.17.0 numpy xacro pyyaml
python test/check_simulation.py cases ../xmobot
```

MIT. See [project license](LICENSE) and [bundled third-party notices](assets/licenses.txt).
