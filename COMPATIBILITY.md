# Compatibility Matrix

Please record your test experience here.
For each test describe:
* phone make and model
* environment
* test-case description including relevant preconditions/outcome
* general remarks

|   model   |   iOS   |   initial loading time   |   response time   |   auth feature loading time   |   preview framerate   |   gl framerate   |   tester   |
------------|---------|--------------------------|-------------------|-------------------------------|-----------------------|------------------|------------|
| SE 1 Gen  | 14.7.1  |                          |                   |                               |                       |                  |     pdm    |
------------|---------|--------------------------|-------------------|-------------------------------|-----------------------|------------------|------------|


Mobile data consumption estimation: 15KiloBytes per second of video-capture.

This estimate is just about executing the authentication feature, and excludes the code loading traffic (and also previous leaflet loading traffic).

# 59k3 Authentication Feature
## Measured timing from an Ad-Hoc build from:
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

## Number of GCDWebServer Instances Impact
### Memory Footprint

|model|milestone in app | 2 webservers (MB) | 1 webserver (MB) |
|-|-----------------|--------------|-------------|
|11 Pro Max|Before WkWebview Loaded|31|32|
||Before Datamatrix Scan|99|87|
||Before 59k3 SSAPP Launch|73|86|
||59k3 SSAPP Running|from 170 to 195|from 150 to 175|
||Back To Home Page|108|108
||
|8|Before WkWebview Loaded|35|36|
||Before Datamatrix Scan|90|87|
||Before 59k3 SSAPP Launch|87|85|
||59k3 SSAPP Running|from 136 to 156|from 135 to 165|
||Back To Home Page|90|93

When repeating the measurement several times, number can differ from +/-20MB for all milestones except the first one.

### Peak CPU Usage while Running 59k3 SSAPP
model| 2 webservers (MB) | 1 webserver (MB) |
|-|--------------|-------------|
|11 Pro Max|28%|27%|
|8|38%|36%

### Context
Code has been rapidly modified so that webserver instance inside ApiContainer can be passed as reference to PharmaledgerMessageHandler instance.  

### Conclusion
Having 2 GCDWebServer instances does not have a huge impact on memory footprint, nor on CPU usage.
