# Sphero command reference (all robots)

Generated from the command table inside the Sphero Edu web app (`/code/sdk/toybox.js`, downloaded 2026-10-09).
It lists every command the Edu app knows for any Sphero robot: name, device id (DID), command id (CID), and the
field types its code uses to build the payload and read the reply. **Field types are read from minified code and
are approximate.** For layouts confirmed on a real BOLT+, see `docs/BOLT_PLUS_PROTOCOL.md`.

"Seen on BOLT+": Tested = we sent it and checked the result; Recorded = Sphero Edu sent it to a BOLT+; blank = not seen.
Being listed here does not mean a particular robot supports a command.

Answered by a BOLT+ but not in this table: `0x16 0x0F` (the spherov2 library calls it "set pitch torque
modification"; avoid), and drive commands `0x16 0x32`, `0x34`, `0x36`, `0x37` (payloads of 8, 9, 8, 3 bytes).

## 0x10 API_AND_SHELL

| CID | Name | Type | Payload (approx.) | Reply or data (approx.) | Seen on BOLT+ |
| --- | --- | --- | --- | --- | --- |
| 0x01 | Get Api Protocol Version | command | none | byte, byte → majorVersion, minorVersion |  |
| 0x02 | Send Command To Shell | command | text |  |  |
| 0x03 | Send String To Console | notification |  | string → consoleString |  |
| 0x05 | Get Supported Dids | command | none | byte → dids |  |
| 0x06 | Get Supported Cids | command | byte | byte → cids |  |

## 0x11 SYSTEM_INFO

| CID | Name | Type | Payload (approx.) | Reply or data (approx.) | Seen on BOLT+ |
| --- | --- | --- | --- | --- | --- |
| 0x00 | Get Main App Version | command | none | int16, int16, int16 → major, minor, revision | Recorded |
| 0x01 | Get Bootloader Version | command | none | int16, int16, int16 → major, minor, revision |  |
| 0x03 | Get Board Revision | command | none | byte → revision | Recorded |
| 0x06 | Get Mac Address | command | none | string → macAddress |  |
| 0x12 | Get Model Number | command | none | byte → model |  |
| 0x13 | Get Stats Id | command | none | int16 → statsId | Recorded |
| 0x1F | Get Processor Name | command | none | string → name |  |
| 0x20 | Get Boot Reason | command | none | byte → bootReason (0=cold_boot, 1=unexpected_reset, 2=application_reset_due_to_error, 3=application_reset_for_a_firmware_update, 4=processor_is_booting_from_sleep, 5=processor_is_resetting_for_some_non_error_reason, 6=unknown_boot_reason, 7=processor_reset_due_to_pin_reset, 8=processor_reset_due_to_watchdog_timer, 9=processor_reset_due_to_cpu_lockup, 10=processor_reset_for_processor_specific_reason, 11=processor_reset_due_to_wake_from_off_on_gpio_interrupt) |  |
| 0x21 | Get Last Error Info | command | none | byte, int16, byte → fileName, lineNumber, data |  |
| 0x28 | Get Three Character Sku | command | none | string → sku |  |
| 0x2B | Write Config Block | command | none |  |  |
| 0x2C | Get Config Block | command | none | int32, int32, byte → metaDataVersion, configBlockVersion, applicationData |  |
| 0x2D | Set Config Block | command | int32, int32 |  |  |
| 0x2E | Erase Config Block | command | int32 |  |  |
| 0x30 | Get Swd Locking Status | command | none | bool → isLocked |  |
| 0x33 | Get Manufacturing Date | command | none | int16, byte, byte → year, month, day | Recorded |
| 0x38 | Get Sku | command | none | string → sku | Recorded |
| 0x39 | Get Core Up Time In Milliseconds | command | none | int64 → upTime |  |
| 0x3A | Get Event Log Status | command | none | int32, int32, int32 → logCapacity, numberOfBytesUsed, numberOfEventsInLog |  |
| 0x3B | Get Event Log Data | command | int32, int32 | byte → logData |  |
| 0x3C | Clear Event Log | command | none |  |  |
| 0x3D | Enable Sos Message Notify | command | bool |  |  |
| 0x3E | Sos Message Notify | notification |  | byte → sosMessage (0=unknown, 1=subprocessor_crashed) |  |
| 0x3F | Get Sos Message | command | none | byte → sosMessage (0=unknown, 1=subprocessor_crashed) |  |
| 0x44 | Clear Sos Message | command | none |  |  |
| 0x47 | Get Uid | command | none | byte → uid | Recorded |
| 0x49 | Jump To Processor Application | command | byte, byte |  |  |

## 0x12 SYSTEM_MODE

| CID | Name | Type | Payload (approx.) | Reply or data (approx.) | Seen on BOLT+ |
| --- | --- | --- | --- | --- | --- |
| 0x26 | Set Play Mode | command | int16 |  |  |
| 0x27 | Get Play Mode | command | none | int16 → identifier |  |
| 0x29 | Enable Desktoy Mode | command | bool |  |  |
| 0x2B | Get Out Of Box State | command | none | bool → isEnabled |  |
| 0x2C | Enable Out Of Box State | command | bool |  |  |

## 0x13 POWER

| CID | Name | Type | Payload (approx.) | Reply or data (approx.) | Seen on BOLT+ |
| --- | --- | --- | --- | --- | --- |
| 0x00 | Enter Deep Sleep | command | byte |  |  |
| 0x03 | Get Battery Voltage | command | none | int16 → voltage | Tested: not supported |
| 0x04 | Get Battery State | command | none | byte → 255, state (0=charged, 1=charging, 2=not_charging, 3=ok, 4=low, 5=critical, 255=unknown) |  |
| 0x05 | Enable Battery State Changed Notify | command | bool |  |  |
| 0x06 | Battery State Changed Notify | notification |  | byte → powerState (0=charged, 1=charging, 2=not_charging, 3=ok, 4=low, 5=critical, 6=reserved, 7=unused) |  |
| 0x0C | Force Battery Refresh | command | none |  |  |
| 0x10 | Get Battery Percentage | command | none | byte → percentage | Tested |
| 0x17 | Get Battery Voltage State | command | none | byte → state (0=unknown, 1=ok, 2=low, 3=critical) | Recorded |
| 0x19 | Will Sleep Notify | notification |  |  |  |
| 0x1A | Did Sleep Notify | notification |  |  |  |
| 0x1B | Enable Battery Voltage State Change Notify | command | bool |  | Recorded |
| 0x1C | Battery Voltage State Change Notify | notification |  | byte → state (0=unknown, 1=ok, 2=low, 3=critical) |  |
| 0x1F | Get Charger State | command | none | byte → chargerState (0=unknown, 1=not_charging, 2=charging, 3=charged) | Recorded |
| 0x20 | Enable Charger State Changed Notify | command | bool |  | Recorded |
| 0x21 | Charger State Changed Notify | notification |  | byte → chargerState (0=unknown, 1=not_charging, 2=charging, 3=charged) |  |
| 0x22 | Get Battery Adc Reading | command | none | int32 → adcReading |  |
| 0x23 | Set Battery Calibration Slope And Intercept | command | float32, float32 |  |  |
| 0x24 | Get Battery Calibration Slope And Intercept | command | none | bool, float, float → hasBatteryBeenCalibrated, voltsPerAdcBit, voltageOffset |  |
| 0x25 | Get Battery Voltage In Volts | command | byte, byte, byte, byte | float → voltage |  |
| 0x26 | Get Battery Voltage State Thresholds | command | none | float, float, float → criticalThreshold, lowThreshold, hysteresis |  |
| 0x27 | Get Current Sense Amplifier Current | command | byte, byte | float → amplifierCurrent |  |
| 0x28 | Get Efuse Fault Status | command | byte | byte → isFaultPresent |  |
| 0x29 | Efuse Fault Occurred Notify | notification |  | byte → efuseId |  |
| 0x2A | Enable Efuse | command | byte |  |  |

## 0x15 DISPLAY

| CID | Name | Type | Payload (approx.) | Reply or data (approx.) | Seen on BOLT+ |
| --- | --- | --- | --- | --- | --- |
| 0x01 | Get Display Mode | command | none | byte → displayMode (0=idle, 1=text, 2=color, 3=matrix, 4=animation, 5=sensor) |  |
| 0x02 | Set Display Color | command | byte, byte, byte |  | Tested |
| 0x03 | Set Display Text | command | text, byte, byte, byte, byte, byte, byte, int16, int16, int16 |  | Recorded |
| 0x05 | Get Animation Id | command | none | int32 → animationId |  |
| 0x06 | Get Display Draw Status | command | none | bool → drawingDone |  |
| 0x07 | Clear Display | command | none |  | Recorded |
| 0x08 | Get Text Color | command | none | byte, byte, byte → red, green, blue |  |
| 0x09 | Get Display Background Color | command | none | byte, byte, byte → red, green, blue |  |
| 0x0A | Get Display Rotation | command | none | byte → rotation (0=rotated_0, 1=rotated_90, 2=rotated_180, 3=rotated_270) |  |
| 0x0B | Set Display Rotation | command | byte, byte, byte, byte |  | Recorded |
| 0x0C | Get Display Protection Status | command | none | byte → protectionStatus (0=protection_status_ok, 1=protection_status_warning, 2=protection_status_critical) |  |
| 0x0E | Enable Display Protection Asyncs | command | bool |  |  |
| 0x0F | Display Protection Changed Async | notification |  | byte → protectionStatus (0=protection_status_ok, 1=protection_status_warning, 2=protection_status_critical) |  |
| 0x10 | Set Animation Id And Looping | command | int32, bool |  | Tested |
| 0x11 | Get Animation Complete Status | command | none | bool → animationComplete | Recorded |
| 0x12 | Enable Animation Complete Asyncs | command | bool |  | Recorded |
| 0x13 | Animation Complete Async | notification |  | int32 → animationId |  |
| 0x14 | Set Display Live Sensor Data | command | int32 |  | Recorded |
| 0x15 | Get Live Sensor Mask | command | none | int32 → sensorMask |  |

## 0x16 DRIVE

| CID | Name | Type | Payload (approx.) | Reply or data (approx.) | Seen on BOLT+ |
| --- | --- | --- | --- | --- | --- |
| 0x01 | Set Raw Motors | command | byte, byte, byte, byte, byte, byte, byte, byte |  | Recorded |
| 0x06 | Reset Yaw | command | none |  | Tested |
| 0x07 | Drive With Heading | command | byte, int16, byte |  | Tested |
| 0x0B | Generic Raw Motor | command | byte, byte, byte, byte, byte, byte, byte, byte |  |  |
| 0x0C | Set Stabilization | command | byte, byte, byte, byte, byte, byte |  |  |
| 0x0E | Set Default Control System For Type | command | byte, byte, byte, byte, byte, byte, byte, byte, byte, byte, byte, byte, byte, byte, byte, byte, byte, byte, byte |  |  |
| 0x20 | Set Component Parameters | command | byte, byte, float32 |  |  |
| 0x21 | Get Component Parameters | command | byte, byte | float → parameters |  |
| 0x22 | Set Custom Control System Timeout | command | int16 |  |  |
| 0x25 | Enable Motor Stall Notify | command | bool |  |  |
| 0x26 | Motor Stall Notify | notification |  | byte, bool → motorIndex, isTriggered (0=left_motor_index, 1=right_motor_index) |  |
| 0x27 | Enable Motor Fault Notify | command | bool |  |  |
| 0x28 | Motor Fault Notify | notification |  | bool → isFault |  |
| 0x29 | Get Motor Fault State | command | none | bool → isFault |  |
| 0x33 | Drive Tank Normalized | command | byte, byte |  |  |
| 0x35 | Drive Rc Normalized | command | byte, byte, flags, byte |  | Tested |
| 0x39 | Drive To Position Normalized | command | int16, float32, float32, byte, byte |  |  |
| 0x3A | Xy Position Drive Result Notify | notification |  | bool → success |  |
| 0x3C | Set Drive Target Slew Parameters | command | float32, float32, float32, float32, byte, byte |  |  |
| 0x3D | Get Drive Target Slew Parameters | command | none | float, float, float, float, byte → linearAcceleration, linearVelocitySlewMethod (0=constant, 1=proportional) |  |
| 0x3E | Stop With Custom Deceleration | command | float32 |  |  |
| 0x3F | Robot Has Stopped Notify | notification |  |  | Recorded |
| 0x42 | Stop With Default Deceleration | command | none |  |  |
| 0x44 | Get Active Control System Id | command | none | byte → controllerId (0=decelerating_stop, 1=raw_motor, 2=tank_drive, 3=drive_with_yaw_advanced_mode, 4=drive_with_yaw_basic_mode, 5=rc_drive_rate_mode, 6=rc_drive_slew_mode, 7=xy_position_drive, 8=infrared_follow_and_evade, 9=magnetometer_calibration, 10=simple_stop, 11=back_emf_calibration, 12=rc_drive_advanced_mode, 13=heading_hold_stop) | Recorded |
| 0x49 | Drive Distance At Yaw Normalized | command | int16, byte, float32 |  | Recorded |
| 0x4C | Drive Time At Yaw Normalized | command | int16, byte, float32 |  | Recorded |
| 0x4D | Reached End Drive For Time Async | notification |  | bool → success | Recorded |
| 0x4E | Reached End Drive To Distance Async | notification |  | bool → success | Recorded |
| 0x50 | Stop With Custom Deceleration And Stabilization | command | float32, bool |  |  |
| 0x51 | Stop With Default Deceleration And Stabilization | command | bool |  | Tested |

## 0x18 SENSOR

| CID | Name | Type | Payload (approx.) | Reply or data (approx.) | Seen on BOLT+ |
| --- | --- | --- | --- | --- | --- |
| 0x00 | Set Sensor Streaming Mask | command | int16, byte, int32 |  | Tested |
| 0x01 | Get Sensor Streaming Mask | command | none | int16, byte, int32 → interval, packetCount, dataMask |  |
| 0x02 | Sensor Streaming Data Notify | notification |  | float → sensorData | Tested |
| 0x0C | Set Extended Sensor Streaming Mask | command | int32 |  | Tested |
| 0x0D | Get Extended Sensor Streaming Mask | command | none | int32 → dataMask |  |
| 0x0F | Enable Gyro Max Notify | command | bool |  | Recorded |
| 0x10 | Gyro Max Notify | notification |  | byte → flags |  |
| 0x11 | Configure Collision Detection | command | byte, byte, byte, byte, byte, byte, byte, byte, byte |  |  |
| 0x12 | Collision Detected Notify | notification |  | int16, int16, int16, byte, int16, int16, byte, int32 → accelerationX, accelerationY, accelerationZ, xAxis, yAxis, powerX, time |  |
| 0x13 | Reset Locator X And Y | command | none |  | Recorded |
| 0x14 | Enable Collision Detected Notify | command | bool |  |  |
| 0x17 | Set Locator Flags | command | byte |  |  |
| 0x22 | Get Bot To Bot Infrared Readings | command | none | int32 |  |
| 0x23 | Get Rgbc Sensor Values | command | none | int16, int16, int16, int16 → redChannelValue, greenChannelValue, blueChannelValue, clearChannelValue |  |
| 0x25 | Magnetometer Calibrate To North | command | none |  |  |
| 0x26 | Magnetometer North Yaw Notify | notification |  | int16 → yawDirection |  |
| 0x27 | Start Robot To Robot Infrared Broadcasting | command | byte, byte |  | Recorded |
| 0x28 | Start Robot To Robot Infrared Following | command | byte, byte |  | Recorded |
| 0x29 | Stop Robot To Robot Infrared Broadcasting | command | none |  | Recorded |
| 0x2A | Send Robot To Robot Infrared Message | command | byte, byte, byte, byte, byte |  |  |
| 0x2B | Listen For Robot To Robot Infrared Message | command | byte, int32 |  |  |
| 0x2C | Robot To Robot Infrared Message Received Notify | notification |  | byte → infraredCode |  |
| 0x30 | Get Ambient Light Sensor Value | command | none | float → ambientLightValue | Tested |
| 0x32 | Stop Robot To Robot Infrared Following | command | none |  | Recorded |
| 0x33 | Start Robot To Robot Infrared Evading | command | byte, byte |  | Recorded |
| 0x34 | Stop Robot To Robot Infrared Evading | command | none |  | Recorded |
| 0x35 | Enable Color Detection Notify | command | bool, int16, byte |  |  |
| 0x36 | Color Detection Notify | notification |  | byte, byte, byte, byte, byte → red, green, blue, confidence, colorClassificationId |  |
| 0x37 | Get Current Detected Color Reading | command | none |  |  |
| 0x38 | Enable Color Detection | command | bool |  |  |
| 0x39 | Configure Streaming Service | command | byte |  |  |
| 0x3A | Start Streaming Service | command | int16 |  |  |
| 0x3B | Stop Streaming Service | command | none |  |  |
| 0x3C | Clear Streaming Service | command | none |  |  |
| 0x3D | Streaming Service Data Notify | notification |  | byte, byte → token, sensorData |  |
| 0x3E | Enable Robot Infrared Message Notify | command | bool |  | Recorded |
| 0x3F | Send Infrared Message | command | byte, byte, byte, byte, byte |  | Recorded |
| 0x40 | Motor Current Notify | notification |  | float, float, int64 → leftMotorCurrent, rightMotorCurrent, upTime |  |
| 0x41 | Enable Motor Current Notify | command | bool |  |  |
| 0x42 | Get Motor Temperature | command | byte, byte | float, float → windingCoilTemperature, caseTemperature |  |
| 0x47 | Configure Sensitivity Based Collision Detection | command | byte, byte, byte, byte, byte, byte, byte, int16 |  | Recorded |
| 0x48 | Enable Sensitivity Based Collision Detection Notify | command | bool |  | Recorded |
| 0x49 | Sensitivity Based Collision Detected Notify | notification |  | int64 → time | Recorded |
| 0x4B | Get Motor Thermal Protection Status | command | none | float, byte, float, byte → leftMotorTemperature, leftMotorStatus, rightMotorTemperature, rightMotorStatus (0=ok, 1=warn, 2=critical, 0=ok, 1=warn, 2=critical) |  |
| 0x4C | Enable Motor Thermal Protection Status Notify | command | bool |  |  |
| 0x4D | Motor Thermal Protection Status Notify | notification |  | float, byte, float, byte → leftMotorTemperature, leftMotorStatus, rightMotorTemperature, rightMotorStatus (0=ok, 1=warn, 2=critical, 0=ok, 1=warn, 2=critical) |  |
| 0x5A | Configure Collision Threshold | command | byte, byte |  | Recorded (ball replies bad value) |

## 0x19 CONNECTION

| CID | Name | Type | Payload (approx.) | Reply or data (approx.) | Seen on BOLT+ |
| --- | --- | --- | --- | --- | --- |
| 0x03 | Set Bluetooth Name | command | text |  |  |
| 0x04 | Get Bluetooth Name | command | none | string → name |  |
| 0x05 | Get Bluetooth Advertising Name | command | none | string → name |  |
| 0x1D | Force Ble Disconnect | command | none |  |  |

## 0x1A IO

| CID | Name | Type | Payload (approx.) | Reply or data (approx.) | Seen on BOLT+ |
| --- | --- | --- | --- | --- | --- |
| 0x04 | Set Led | command | byte, byte, byte, byte |  |  |
| 0x0E | Set All Leds With 16 Bit Mask | command | int16 |  |  |
| 0x19 | Start Idle Led Animation | command | none |  |  |
| 0x1A | Set All Leds With 32 Bit Mask | command | int32 |  | Tested |
| 0x1B | Set All Leds With 64 Bit Mask | command | see code |  |  |
| 0x1C | Set All Leds With 8 Bit Mask | command | byte |  |  |
| 0x2D | Set Compressed Frame Player Pixel | command | byte, byte, byte, byte, byte |  | Recorded |
| 0x2E | Set Compressed Frame Player | command | see code |  |  |
| 0x2F | Set Compressed Frame Player One Color | command | byte, byte, byte |  | Recorded |
| 0x30 | Save Compressed Frame Player 64 Bit Frame | command | int16 |  |  |
| 0x31 | Save Compressed Frame Player Animation | command | byte, byte, bool, byte, int16, int16 | byte → animationIndex |  |
| 0x32 | Play Compressed Frame Player Animation | command | byte |  |  |
| 0x33 | Play Compressed Frame Player Frame | command | int16 |  |  |
| 0x34 | Get Compressed Frame Player List Of Frames | command | none | int16 → frameIndexes |  |
| 0x35 | Delete All Compressed Frame Player Animations And Frames | command | none |  |  |
| 0x36 | Pause Compressed Frame Player Animation | command | none |  | Recorded |
| 0x37 | Resume Compressed Frame Player Animation | command | none |  | Recorded |
| 0x38 | Reset Compressed Frame Player Animation | command | none |  | Recorded |
| 0x39 | Override Compressed Frame Player Animation Global Settings | command | byte, byte, byte, byte |  | Recorded |
| 0x3A | Set Compressed Frame Player Frame Rotation | command | byte, byte, byte, byte |  | Recorded |
| 0x3B | Set Compressed Frame Player Text Scrolling | command | byte, byte, byte, byte, bool, text |  | Recorded |
| 0x3C | Set Compressed Frame Player Text Scrolling Notify | notification |  | byte → textScrollingReason (0=done, 1=looping) |  |
| 0x3D | Draw Compressed Frame Player Line | command | byte, byte, byte, byte, byte, byte, byte |  | Recorded |
| 0x3E | Draw Compressed Frame Player Fill | command | byte, byte, byte, byte, byte, byte, byte |  | Recorded |
| 0x3F | Compressed Frame Player Animation Complete Notify | notification |  | byte → completeEvent |  |
| 0x40 | Assign Compressed Frame Player Frames To Animation | command | byte, int16, int16 |  |  |
| 0x41 | Save Compressed Frame Player Animation Without Frames | command | byte, byte, bool, byte, int16 | byte → savedAnimations |  |
| 0x42 | Set Compressed Frame Player Single Character | command | byte, byte, byte, text |  | Recorded |
| 0x43 | Play Compressed Frame Player Animation With Loop Option | command | byte, bool |  |  |
| 0x44 | Get Active Color Palette | command | none | byte → rgbIndexBytes |  |
| 0x45 | Set Active Color Palette | command | see code |  |  |
| 0x46 | Get Color Identification Report | command | byte, byte, byte, byte | byte → indexConfidenceByte |  |
| 0x47 | Load Color Palette | command | byte, byte |  |  |
| 0x48 | Save Color Palette | command | byte, byte |  |  |
| 0x4C | Get Compressed Frame Player Frame Info Type | command | none | byte → frameInfoType (0=compressed_frame_player_info_type_8_bit, 1=compressed_frame_player_info_type_16_bit, 2=compressed_frame_player_info_type_32_bit, 3=compressed_frame_player_info_type_64_bit) |  |
| 0x4D | Save Compressed Frame Player 16 Bit Frame | command | int16, int16, int16, int16, int16 | int16 → frameIndex |  |
| 0x4E | Release Led Requests | command | none |  |  |

## 0x1D FIRMWARE

| CID | Name | Type | Payload (approx.) | Reply or data (approx.) | Seen on BOLT+ |
| --- | --- | --- | --- | --- | --- |
| 0x0D | Get Pending Update Flags | command | none | int32 → updateFlags |  |
| 0x15 | Get Current Application Id | command | none | byte → applicationId (0=bootloader, 1=main_app) | Recorded |
| 0x16 | Get All Updatable Processors | command | none |  |  |
| 0x18 | Get Version For Updatable Processors | command | none |  |  |
| 0x1A | Set Pending Update For Processors | command | see code | byte → resetStrategyRecommendation (1=reset_into_or_jump_to_main_app, 2=reset_into_or_jump_to_bootloader) |  |
| 0x1B | Get Pending Update For Processors | command | none | byte → processorIds |  |
| 0x1C | Reset With Parameters | command | byte, byte |  |  |
| 0x26 | Clear Pending Update Processors | command | see code |  |  |

## 0x1F FACTORY_TEST

| CID | Name | Type | Payload (approx.) | Reply or data (approx.) | Seen on BOLT+ |
| --- | --- | --- | --- | --- | --- |
| 0x13 | Get Factory Mode Challenge | command | none | int32 → securityChallenge |  |
| 0x14 | Enter Factory Mode | command | int32 |  |  |
| 0x15 | Exit Factory Mode | command | none |  |  |
| 0x27 | Get Chassis Id | command | none | int16 → identifier |  |
| 0x31 | Enable Extended Life Test | command | bool |  |  |
| 0x34 | Get Factory Mode Status | command | none | bool → factoryStatus |  |
| 0x58 | Read Gpio Input | command | int32 | bool → pinState |  |
| 0x59 | Write Gpio Output | command | int32, bool |  |  |
| 0x5A | Set Pin As Gpio Input | command | int32, byte, byte, byte |  |  |
| 0x5B | Set Pin As Gpio Output | command | int32, bool |  |  |
| 0x5C | Unset Gpio Input Pin | command | int32 |  |  |
| 0x5D | Unset Gpio Output Pin | command | int32 |  |  |
| 0x5E | Set Unrestricted Mode | command | bool |  |  |
| 0x60 | I2C Scan | command | byte | byte → twiAddressFound |  |
