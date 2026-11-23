/*
  Breath & Bloom prototype firmware
  Target: ESP32-C6-DevKitC-1, Arduino-ESP32 3.x, NimBLE-Arduino 2.x
  OLED: SSD1306 I2C, 128x64, address 0x3C (verify your module)
  RGB LED: one discrete common-cathode LED with a resistor per color

  BLE sends only device state (mode/phase/pace). It does not collect or store
  mood, identity, location, or session history.
*/
#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <NimBLEDevice.h>

static constexpr uint8_t PIN_SDA = 6;
static constexpr uint8_t PIN_SCL = 7;
static constexpr uint8_t PIN_ENCODER_CLK = 18;
static constexpr uint8_t PIN_ENCODER_DT = 19;
static constexpr uint8_t PIN_ENCODER_SW = 20;
static constexpr uint8_t PIN_MODE_BUTTON = 21;
static constexpr uint8_t PIN_LED_R = 10;
static constexpr uint8_t PIN_LED_G = 11;
static constexpr uint8_t PIN_LED_B = 22;
static constexpr uint8_t SCREEN_WIDTH = 128;
static constexpr uint8_t SCREEN_HEIGHT = 64;

static const char *SERVICE_UUID = "7a4e0001-7c7f-4f2e-9d8d-8e1e2c4b0100";
static const char *STATE_UUID   = "7a4e0002-7c7f-4f2e-9d8d-8e1e2c4b0100";
static const char *COMMAND_UUID = "7a4e0003-7c7f-4f2e-9d8d-8e1e2c4b0100";

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
NimBLECharacteristic *stateCharacteristic = nullptr;
NimBLECharacteristic *commandCharacteristic = nullptr;
NimBLEServer *bleServer = nullptr;

enum class Mode : uint8_t { Breath, Grounding };
Mode mode = Mode::Breath;
bool running = false;
uint8_t paceSeconds = 4;
uint8_t lastClk = HIGH;
uint8_t lastEncoderButton = HIGH;
uint8_t lastModeButton = HIGH;
uint32_t encoderDebounceAt = 0;
uint32_t modeDebounceAt = 0;
uint32_t startedAt = 0;
uint32_t lastDisplayAt = 0;
uint32_t lastNotifyAt = 0;
String lastState = "";
String lastCommand = "";

const char *groundingPrompts[] = {
  "Notice 5 things you see",
  "Notice 4 things you feel",
  "Notice 3 things you hear",
  "Notice 2 things you smell",
  "Notice 1 thing you taste"
};
static constexpr uint8_t GROUNDING_STEPS = 5;

void setRgb(uint8_t red, uint8_t green, uint8_t blue) {
  // For a common-cathode LED, duty 0 is off and 255 is brightest.
  ledcWrite(PIN_LED_R, red);
  ledcWrite(PIN_LED_G, green);
  ledcWrite(PIN_LED_B, blue);
}

void showScreen(const String &line1, const String &line2, const String &line3 = "") {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 4);
  display.println("BREATH & BLOOM");
  display.drawLine(0, 17, 127, 17, SSD1306_WHITE);
  display.setCursor(0, 23);
  display.println(line1);
  display.setCursor(0, 39);
  display.println(line2);
  display.setCursor(0, 55);
  display.println(line3);
  display.display();
}

void publishState(const String &eventName, const String &phase, uint8_t remaining) {
  const String modeName = mode == Mode::Breath ? "breath" : "grounding";
  char payload[150];
  snprintf(payload, sizeof(payload),
           "{\"v\":1,\"event\":\"%s\",\"mode\":\"%s\",\"phase\":\"%s\",\"remaining\":%u,\"pace\":%u}",
           eventName.c_str(), modeName.c_str(), phase.c_str(), remaining, paceSeconds);
  const String state(payload);
  if (state == lastState || stateCharacteristic == nullptr) return;
  lastState = state;
  stateCharacteristic->setValue(state.c_str());
  if (bleServer != nullptr && bleServer->getConnectedCount() > 0) {
    stateCharacteristic->notify();
  }
  lastNotifyAt = millis();
}

void handleCommand(const String &command) {
  if (command == "start") {
    running = true;
    startedAt = millis();
  } else if (command == "pause") {
    running = false;
  } else if (command == "stop") {
    running = false;
    setRgb(0, 0, 0);
  } else if (command == "mode:breath") {
    mode = Mode::Breath;
    startedAt = millis();
  } else if (command == "mode:grounding") {
    mode = Mode::Grounding;
    startedAt = millis();
  }
  lastState = ""; // Force the next state publication.
}

class DeviceCallbacks : public NimBLEServerCallbacks {
  void onDisconnect(NimBLEServer *server, NimBLEConnInfo &connInfo, int reason) override {
    (void)connInfo;
    (void)reason;
    NimBLEDevice::startAdvertising();
  }
};

void setupBle() {
  NimBLEDevice::init("Manasika-BreathBloom");
  bleServer = NimBLEDevice::createServer();
  bleServer->setCallbacks(new DeviceCallbacks());
  NimBLEService *service = bleServer->createService(SERVICE_UUID);
  stateCharacteristic = service->createCharacteristic(
      STATE_UUID, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
  commandCharacteristic = service->createCharacteristic(
      COMMAND_UUID, NIMBLE_PROPERTY::WRITE);
  stateCharacteristic->setValue("{\"v\":1,\"event\":\"ready\",\"mode\":\"breath\",\"phase\":\"idle\",\"remaining\":0,\"pace\":4}");
  service->start();
  NimBLEAdvertising *advertising = NimBLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setName("Manasika-BreathBloom");
  advertising->start();
}

void pollEncoder() {
  const uint8_t clk = digitalRead(PIN_ENCODER_CLK);
  if (lastClk == HIGH && clk == LOW) {
    const int direction = digitalRead(PIN_ENCODER_DT) != clk ? 1 : -1;
    const int nextPace = constrain(static_cast<int>(paceSeconds) + direction, 3, 8);
    if (nextPace != paceSeconds) {
      paceSeconds = static_cast<uint8_t>(nextPace);
      lastState = "";
    }
  }
  lastClk = clk;

  const uint8_t encoderButton = digitalRead(PIN_ENCODER_SW);
  if (encoderButton == LOW && lastEncoderButton == HIGH && millis() - encoderDebounceAt > 45) {
    encoderDebounceAt = millis();
    running = !running;
    if (running) startedAt = millis();
    lastState = "";
  }
  lastEncoderButton = encoderButton;

  const uint8_t modeButton = digitalRead(PIN_MODE_BUTTON);
  if (modeButton == LOW && lastModeButton == HIGH && millis() - modeDebounceAt > 45) {
    modeDebounceAt = millis();
    mode = mode == Mode::Breath ? Mode::Grounding : Mode::Breath;
    startedAt = millis();
    lastState = "";
  }
  lastModeButton = modeButton;
}

void processBleCommand() {
  if (commandCharacteristic == nullptr) return;
  const std::string raw = commandCharacteristic->getValue();
  if (raw.empty()) return;
  const String command(raw.c_str());
  commandCharacteristic->setValue("");
  if (command == lastCommand) lastCommand = "";
  lastCommand = command;
  handleCommand(command);
}

void updateExercise() {
  const uint32_t now = millis();
  if (!running) {
    setRgb(0, 0, 0);
    showScreen(mode == Mode::Breath ? "Breathing guide" : "Grounding guide",
               mode == Mode::Breath ? "Turn knob: pace" : "5-4-3-2-1 senses",
               "Press knob to begin");
    publishState("status", "idle", 0);
    return;
  }

  const uint32_t elapsed = now - startedAt;
  if (mode == Mode::Breath) {
    const uint32_t inhaleMs = static_cast<uint32_t>(paceSeconds) * 1000UL;
    const uint32_t exhaleMs = static_cast<uint32_t>(paceSeconds + 2) * 1000UL;
    const uint32_t cycleMs = inhaleMs + exhaleMs;
    const uint32_t cyclePosition = elapsed % cycleMs;
    const bool inhaling = cyclePosition < inhaleMs;
    const uint32_t phasePosition = inhaling ? cyclePosition : cyclePosition - inhaleMs;
    const uint32_t phaseDuration = inhaling ? inhaleMs : exhaleMs;
    const uint8_t remaining = static_cast<uint8_t>((phaseDuration - phasePosition + 999) / 1000);
    const uint8_t brightness = static_cast<uint8_t>(inhaling
        ? (phasePosition * 70UL / inhaleMs)
        : (70UL - phasePosition * 70UL / exhaleMs));
    setRgb(0, brightness, static_cast<uint8_t>(brightness + 12));
    const String phase = inhaling ? "inhale" : "exhale";
    showScreen(inhaling ? "Breathe in gently" : "Breathe out slowly",
               "No need to hold your breath", String("Pace ") + paceSeconds + " sec");
    publishState("phase", phase, remaining);
  } else {
    const uint8_t step = static_cast<uint8_t>((elapsed / 7000UL) % GROUNDING_STEPS);
    setRgb(0, 24, 30);
    showScreen("Take your time", groundingPrompts[step], "Press knob to pause");
    publishState("prompt", String("step-") + (step + 1), 7 - ((elapsed / 1000UL) % 7));
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_ENCODER_CLK, INPUT_PULLUP);
  pinMode(PIN_ENCODER_DT, INPUT_PULLUP);
  pinMode(PIN_ENCODER_SW, INPUT_PULLUP);
  pinMode(PIN_MODE_BUTTON, INPUT_PULLUP);
  ledcAttach(PIN_LED_R, 2000, 8);
  ledcAttach(PIN_LED_G, 2000, 8);
  ledcAttach(PIN_LED_B, 2000, 8);
  setRgb(0, 0, 0);

  Wire.begin(PIN_SDA, PIN_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED not found. Check SDA/SCL, power, and I2C address.");
  } else {
    showScreen("Starting up...", "USB power only", "BLE: initializing");
  }
  setupBle();
  Serial.println("Breath & Bloom ready; connect to Manasika-BreathBloom.");
}

void loop() {
  pollEncoder();
  processBleCommand();
  if (millis() - lastDisplayAt >= 250) {
    lastDisplayAt = millis();
    updateExercise();
  }
  delay(5);
}
