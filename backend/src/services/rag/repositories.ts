import type { RepositoryConfig } from './oai-harvester.service.js';

/**
 * Ghanaian institutional repositories and journals with an OAI-PMH endpoint.
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

  // Ghanaian journals on African Journals Online (OJS, one OAI-PMH endpoint per journal, 20
  // records a page). Verified 2026-10-18. robots.txt allows /oai, but AJOL's AWS firewall
  // challenges clients that send more than about ten requests in quick succession
  // (HTTP 202, empty body), so these are paced at one request every 20 s, and a challenge
  // makes the run wait, then skip the rest of AJOL until next week.
  ...([
    ['AJOL_GMJ', 'gmj', 'Ghana Medical Journal'],
    ['AJOL_JUST', 'just', 'Journal of Science and Technology (Ghana)'],
    ['AJOL_GJAS', 'gjas', 'Ghana Journal of Agricultural Science'],
    ['AJOL_GJDS', 'gjds', 'Ghana Journal of Development Studies'],
    ['AJOL_GJG', 'gjg', 'Ghana Journal of Geography'],
    ['AJOL_LJH', 'ljh', 'Legon Journal of the Humanities'],
  ] as const).map(([name, path, journal]): RepositoryConfig => ({
    name,
    oaiBaseUrl: `https://www.ajol.info/index.php/${path}/oai`,
    oaiSet: '',
    institution: journal,
    institutionType: 'university',
    dspaceVersion: 7,
    platform: 'ojs',
    requestIntervalMs: 20_000,
  })),
];
