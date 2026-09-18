# Browser/device matrix

| Configuration | Evidence | Qualification |
| --- | --- | --- |
| macOS 26.6.2 arm64; Node 20.18; Playwright Chromium 1.63.0 bundled engine, software WebGL | Automated shell, synthetic-hand full session, actual model/worker blank-frame, failure/lifecycle tests | Automated behavior only; not physical tracking/performance |
| Local desktop Chrome on available macOS machine | Live visual review at native viewport and laptop size | Art/layout review only |
| Apple Silicon laptop, branded Safari/current Chrome with physical webcam | Not run | Pending |
| Windows laptop with integrated GPU and 720p webcam, Chrome/Edge | Not available | Pending |
| Firefox / mobile devices | Not qualified | Not claimed supported |

For each physical device record CPU/GPU, RAM, OS/browser versions, camera resolution/frame rate, lighting and graphics preset. Apply every input/render gate independently; do not average a slow/failing platform into a pass.
