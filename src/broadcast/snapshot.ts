// Canonical string of a validated form. Equal models give equal snapshots.
// Includes the TEST flag. Repeat is not part of the model, so it is never included.
import type { FormModel } from './form';

export function formSnapshot(model: FormModel): string {
  return JSON.stringify([
    model.event,
    model.urgency,
    model.severity,
    model.action,
    model.placeName,
    model.latitude,
    model.longitude,
    model.validSteps,
    model.stationId,
    model.test,
  ]);
}
