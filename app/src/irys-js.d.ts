declare module "@irys/js/node" {
  export class IrysClient {
    node(url?: string): Promise<IrysClient>;
    createTransaction(attributes?: any): any;
    api: {
      get(path: string): Promise<{ status: number; data?: any }>;
      rpcProvider: unknown;
    };
    programmableData: {
      read(
        txId: string,
        offset: number,
        length: number
      ): { toAccessList(): Promise<any> };
    };
  }
}
