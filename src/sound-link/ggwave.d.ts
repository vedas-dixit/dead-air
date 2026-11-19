// The parts of ggwave 0.4.0 that the Sound Link uses. The package ships no types.
declare module 'ggwave' {
  export interface GgwaveParameters {
    sampleRateInp: number;
    sampleRateOut: number;
    [key: string]: unknown;
  }
  export interface GgwaveEngine {
    ProtocolId: Record<string, number>;
    getDefaultParameters(): GgwaveParameters;
    /** Returns an instance handle, or -1 when ggwave has no room for another instance. */
    init(parameters: GgwaveParameters): number;
    free(instance: number): void;
    /** The result is a view into a shared buffer. Copy it before the next call. */
    encode(instance: number, payload: Uint8Array, protocolId: number, volume: number): Int8Array;
    /** Takes exactly one Frame of Float32 samples seen as bytes. The result is a view. */
    decode(instance: number, frame: Int8Array): Int8Array;
    disableLog(): void;
    rxToggleProtocol(protocolId: number, state: number): void;
  }
  export interface GgwaveModuleOverrides {
    print?: (text: string) => void;
    printErr?: (text: string) => void;
  }
  const factory: (overrides?: GgwaveModuleOverrides) => Promise<GgwaveEngine>;
  export default factory;
}
