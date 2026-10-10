import type { RepositoryConfig } from './oai-harvester.service.js';

/**
 * Ghanaian institutional repositories with a working OAI-PMH endpoint.
 * Verified with ?verb=Identify on 2026-10-10. `name` is the knowledge_chunks.source_name.
 * Not reachable at that date (retry later): UDS, UHAS, UMaT, UENR, GIMPA, UPSA.
 */
export const GHANA_REPOSITORIES: RepositoryConfig[] = [
  { name: 'UGSpace', oaiBaseUrl: 'https://ugspace.ug.edu.gh/server/oai/request', oaiSet: '', institution: 'University of Ghana', institutionType: 'university', dspaceVersion: 7 },
  { name: 'KNUST', oaiBaseUrl: 'https://ir.knust.edu.gh/server/oai/request', oaiSet: '', institution: 'Kwame Nkrumah University of Science and Technology', institutionType: 'university', dspaceVersion: 7 },
  { name: 'UCC', oaiBaseUrl: 'https://ir.ucc.edu.gh/server/oai/request', oaiSet: '', institution: 'University of Cape Coast', institutionType: 'university', dspaceVersion: 7 },
  { name: 'UEW', oaiBaseUrl: 'https://ir.uew.edu.gh/oai/request', oaiSet: '', institution: 'University of Education, Winneba', institutionType: 'university', dspaceVersion: 6 },
  { name: 'Ashesi_AIR', oaiBaseUrl: 'https://air.ashesi.edu.gh/server/oai/request', oaiSet: '', institution: 'Ashesi University', institutionType: 'university', dspaceVersion: 7 },
  { name: 'HF_NMTC_Berekum', oaiBaseUrl: 'https://ir.nmtcberekum.edu.gh/server/oai/request', oaiSet: '', institution: 'Holy Family Nursing and Midwifery Training College, Berekum', institutionType: 'nmtc', dspaceVersion: 7 },
];
