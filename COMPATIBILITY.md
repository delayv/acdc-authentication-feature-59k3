# Compatibility Matrix

Please record your test experience here.
For each test describe:
* phone make and model
* environment
* test-case description including relevant preconditions/outcome
* general remarks

---

Measured timing from an Ad-Hoc build from:
* acdc-workspace: commit 03271f68f88d3e7473a75d12bc612d640ff08c0d
* acdc-authentication-feature-59k3: 38f82e003ba2573e69d1dec85e691feb77fb1e3f
* acdc-ios-edge-agent: b423cbfd33f847d001b731a3514e5856af0e8285
* pharmaledger-camera: 2c9422b8781c8df49378d3df89e4e7a1c0b6f3b7

| date      | C / B |   model   |   iOS   |   initial loading time   |   resp time(1) |  auth feature 59k3 load. time |  preview framerate(2) | gl framerate    | remarks                           |   tester    |
|-----------|-------|-----------|---------|--------------------------|----------------|-------------------------------|-----------------------|-----------------|-----------------------------------|-------------|
| 22 oct 21 | C     | 12        | 15.0.2  | Not Mesured              | Not Mesured    | Not Mesured                   |  Not Mesured          |  Not Mesured    | fluid                             |   59k3      |
| 22 oct 21 | C     | 13Pro     | 15.0.2  | Not Mesured              | Not Mesured    | Not Mesured                   |  Not Mesured          |  Not Mesured    | fluid                             |   59k3      |
| 27 oct 21 | C     | 8         | 15.0.2  | 15.7s                    |  42.9s         |     17.7s                     |24, drops to 8 at ~60s |  Not Mesured    |minimum model for user-friendliness|   59k3      |
| 27 oct 21 | B     | 8         | 15.0.2  | Instant                  |  22.4s         |     12.4s                     |  Not Mesured          |  Not Mesured    |minimum model for user-friendliness|   59k3      |
| 27 oct 21 | C     | 11ProMax  | 15.0.2  | 13.5s                    |  36.3s         |     5.5s                      |        35 (3)         |  Not Mesured    |fluid                              |   59k3      |
| 27 oct 21 | B     | 11ProMax  | 15.0.2  | Instant                  |  18.3s         |     4.6s                      |  Not Mesured          |  Not Mesured    |fluid                              |   59k3      |

* ( C / B ): Cold start or from background
* (1): Interpreted as time-to-detect (i.e.: the time it takes to obtain positive authentication of the package)
* (2): Using `Native` menu, hd1920x1080, RGB, torch ON, Button `Start(MJPEG)`, reporting value `max FPS=xx`
* (3): Small framerate drop to 16FPS at ~60s during ~5s, then continues smoothly. Framerate was observed during more than 5min.