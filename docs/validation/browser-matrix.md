# Browser/device matrix

| Configuration | Evidence | Qualification |
| --- | --- | --- |
| macOS 26.6.2 arm64; Node 20.18; Playwright Chromium 1.63.0 bundled engine, software WebGL | Automated shell, synthetic-hand full session, actual model/worker blank-frame, failure/lifecycle tests | Automated behavior only; not physical tracking/performance |
| macOS 26.6.2 arm64; Playwright 1.63.0, WebKit 26.6 | Automated rendering, synthetic-hand gameplay, actual model/worker inference, photographed-hand camera pipeline through calibration into gameplay with zero frame metadata, production camera lifecycle, audio and startup failure checks | Automated WebKit behavior; installed Safari and physical-camera evidence recorded separately below |
| Installed Safari 26.6.2 on macOS 26.6.2 arm64 | Physical 640×480 camera reproduced constant-zero frame metadata; after the timestamp fix, real hand detection and progression to reach calibration worked. 5,010 results accepted, 3 capture-queue drops, 25.4 ms mean age. A real-model photographed-hand run completed calibration, gameplay (650 points, 16 active seconds), and results. Earlier synthetic-video test covered disconnect/reconnect and hidden-tab release | Physical camera/model/controller and native end-to-end evidence on this device; sustained physical gameplay/performance qualification remains separate |
| Local desktop Chrome on available macOS machine | Live visual review at native viewport and laptop size | Art/layout review only |
| Apple Silicon laptop, branded Safari/current Chrome with physical webcam | Native Safari physical-camera tracking exercised as above; Chrome physical-camera comparison not recorded | Broader device and sustained two-hand qualification pending |
| Windows laptop with integrated GPU and 720p webcam, Chrome/Edge | Not available | Pending |
| Firefox / mobile devices | Not qualified | Not claimed supported |

For each physical device record CPU/GPU, RAM, OS/browser versions, camera resolution/frame rate, lighting and graphics preset. Apply every input/render gate independently; do not average a slow/failing platform into a pass.
