import { api } from './customAxiosInstance';
import type { TripleSend } from '../types/graphTypes';

const getAllObjects = async () => {
  return api.get<string[]>('/objects');
}

const getAllPredicates = async () => {
  return api.get<string[]>('/predicates');
}

const getAllSubjects = async () => {
  return api.get<string[]>('/subjects');
}

const postPredicate = async (predicate: string) => {
  return api.post('/predicates', { predicate });
}

const postObject = async (object: string) => {
  return api.post('/objects', { object });
}

const postTriple = async (triple: TripleSend) => {
  return api.post('/competencies/triple', {subject: triple.subject, predicate: triple.predicate, object: triple.object});
}

export { getAllObjects, getAllPredicates, getAllSubjects, postPredicate, postObject, postTriple };