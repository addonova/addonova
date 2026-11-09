export interface AddonovaPlugin {
  name: string;
  buildStart?(): Promise<void> | void;
  transform?(
    code: string,
    id: string,
  ): Promise<string | null> | string | null;
  buildEnd?(): Promise<void> | void;
}
