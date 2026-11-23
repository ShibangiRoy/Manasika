// Copy to shivUIdes/manasika-ui/src/breathBloomBle.ts when adding the BLE panel.
// Web Bluetooth is intentionally requested only from a user click.
const SERVICE_UUID = "7a4e0001-7c7f-4f2e-9d8d-8e1e2c4b0100";
const STATE_UUID = "7a4e0002-7c7f-4f2e-9d8d-8e1e2c4b0100";
const COMMAND_UUID = "7a4e0003-7c7f-4f2e-9d8d-8e1e2c4b0100";

export type BreathBloomState = {
  v: 1;
  event: "ready" | "status" | "phase" | "prompt";
  mode: "breath" | "grounding";
  phase: string;
  remaining: number;
  pace: number;
};

type BluetoothLike = {
  requestDevice(options: unknown): Promise<any>;
};

export async function connectBreathBloom(onState: (state: BreathBloomState) => void) {
  const bluetooth = (navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth;
  if (!window.isSecureContext || !bluetooth) {
    throw new Error("Bluetooth requires HTTPS and a supported browser. Try current Chrome or Edge, or use the on-device controls.");
  }

  const device = await bluetooth.requestDevice({
    filters: [{ namePrefix: "Manasika-BreathBloom", services: [SERVICE_UUID] }],
    optionalServices: [SERVICE_UUID],
  });
  const server = await device.gatt?.connect();
  if (!server) throw new Error("Could not connect to the Breath & Bloom device.");
  const service = await server.getPrimaryService(SERVICE_UUID);
  const stateCharacteristic = await service.getCharacteristic(STATE_UUID);
  const commandCharacteristic = await service.getCharacteristic(COMMAND_UUID);

  const onValueChanged = (event: Event) => {
    const characteristic = event.target as any;
    const value: DataView | null = characteristic.value;
    if (!value) return;
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    try {
      const state = JSON.parse(new TextDecoder().decode(bytes)) as BreathBloomState;
      if (state.v === 1) onState(state);
    } catch {
      // Ignore malformed or unsupported status messages and keep the BLE link alive.
    }
  };
  stateCharacteristic.addEventListener("characteristicvaluechanged", onValueChanged);
  await stateCharacteristic.startNotifications();

  return {
    device,
    async send(command: "start" | "pause" | "stop" | "mode:breath" | "mode:grounding") {
      await commandCharacteristic.writeValue(new TextEncoder().encode(command));
    },
    disconnect() {
      stateCharacteristic.removeEventListener("characteristicvaluechanged", onValueChanged);
      if (device.gatt?.connected) device.gatt.disconnect();
    },
  };
}
