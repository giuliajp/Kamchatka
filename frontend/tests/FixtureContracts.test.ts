import { expect, it } from 'vitest';
import { fixtureResponse } from './fixtures';
import type { ParticipantDetail, Protocols, Results } from '../src/types/api';

it('keeps the second map participant’s identity and participation consistent', () => {
  const person = fixtureResponse('/api/participants/502') as ParticipantDetail;
  expect(person.id).toBe(502);
  expect(person.full_name).toBe('Петров Иван');
  expect(person.races[0].race_participant_id).toBe(9002);
});
it('returns the selected stage’s standings and protocol metadata in browser fixtures', () => {
  const results = fixtureResponse('/api/races/10/results?stage=2') as Results;
  const protocols = fixtureResponse('/api/stages/102/protocols') as Protocols;
  expect(results.up_to_stage).toBe(2);
  expect(results.disciplines[0].stages[0]).toMatchObject({ id: 102, number: 2 });
  expect(results.disciplines[0].rows[0].stages[0].stage_number).toBe(2);
  expect(protocols.stage.id).toBe(102);
  expect(protocols.protocols[0].rows[0].stages[0].stage_number).toBe(2);
});
