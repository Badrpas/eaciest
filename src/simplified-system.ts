import { System, TEntityRequirements } from './system';

export type TSystemUpdateMethod = (dt?: number) => void;
export const dummyUpdateMethod: TSystemUpdateMethod = (dt?: number) => {
};

/**
 * Used for simplified handler declaration via engine.add()
 */
export class SimplifiedSystem extends System {
  private _updateHandler: TSystemUpdateMethod = dummyUpdateMethod;

  constructor (update: TSystemUpdateMethod, requirements: TEntityRequirements = null) {
    super(requirements);
    this._updateHandler = update;
    this.requirements = requirements;
  }

  update = (dt?: number) => {
    this._updateHandler(dt);
  }
}
