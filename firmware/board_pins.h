// Pin map for the flashing-lights v0.1 hardware (control board + LED board).
// Generated from hardware/control-board.circuit.tsx and
// hardware/led-board.circuit.tsx - keep in sync if those change.
#pragma once
#include <stdint.h>

// ---------------------------------------------------------------- ESP32-S3
// power
#define PIN_PWR_HOLD     11  // high = keep the battery latch on (set first thing in setup())
#define PIN_BTN1_POWER   38  // power button sense, active low (pull-up), long press = off
#define PIN_BTN2         0   // also BOOT strap, active low (external 10k pull-up)
#define PIN_BTN3         39  // active low, enable internal pull-up
#define PIN_BTN4         40  // active low, enable internal pull-up

// LED rails
#define PIN_BOOST_EN     12  // TPS61089 enable (VBOOST for G/B strings), active high
#define PIN_BOOST_TRIM   13  // LEDC PWM -> RC -> boost FB: 0% ~11.4 V, idle/hi-Z 10.5 V, 100% ~8.9 V
#define PIN_PCA_OE       15  // PCA9685 /OE, active low (10k pull-up = LEDs off at boot)

// I2C: PCA9685 (0x40) on the LED board, BQ25887 charger. The BQ25887 datasheet
// gives both 0x6A (8.3.11) and 0x6B (8.3.11.5, register map): probe both.
#define PIN_I2C_SDA      9
#define PIN_I2C_SCL      10
#define I2C_ADDR_PCA9685 0x40
#define I2C_ADDR_BQ25887     0x6B
#define I2C_ADDR_BQ25887_ALT 0x6A

// charger
#define PIN_CHG_INT      16  // BQ25887 /INT, open drain, active low
#define PIN_CHG_PG       17  // BQ25887 /PG, active low = good USB input
#define PIN_CHG_CD       18  // drive high to disable charging (100k pull-down = charging enabled)

// analog (ADC1)
#define PIN_ADC_VSYS     4   // VSYS * 33k/(100k+33k)
#define PIN_ADC_VBOOST   5   // VBOOST * 22k/(100k+22k)
#define PIN_ADC_NTC_LED  6   // LED-board NTC (10k B3380) with 10k pull-up to 3V3
#define PIN_ADC_CC1      7   // USB-C CC1 through 10k (5.1k Rd): ~0.4 V default, ~0.9 V 1.5 A, ~1.7 V 3 A
#define PIN_ADC_CC2      8

#define PIN_LED_STATUS   14  // green LED on the rear, active high
// USB D-/D+ = GPIO19/GPIO20 (native USB, used for flashing and config)

// ---------------------------------------------------------------- LED board
// Columns 0..3 left to right (seen from the front), dies R, G, B, A.
// R and A strings run from VBAT, G and B strings from VBOOST.
enum Die : uint8_t { DIE_R = 0, DIE_G = 1, DIE_B = 2, DIE_A = 3 };

// PCA9685 output channel for [column][die]
static const uint8_t PCA_CHANNEL[4][4] = {
    //        R   G   B   A
    /* c0 */ { 7,  6,  5,  4},
    /* c1 */ { 3,  2,  1,  0},
    /* c2 */ {15, 14, 13, 12},
    /* c3 */ {11, 10,  9,  8},
};

// Each string is a 3-die series string at ~335 mA (0.33R sense, 27k/1k divider
// of the 3.3 V PWM high level). PWM duty = brightness. Keep the PCA9685 PWM
// frequency <= 1 kHz so the per-channel op-amps (powered by the PWM line
// itself) settle within each on-period.
#define PCA_PWM_HZ 800

// Firmware power cap: the full array can draw ~60 W with every die on.
// Stay below ~20 W average from the 2S pack and watch PIN_ADC_NTC_LED.
