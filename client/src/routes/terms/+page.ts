import { pageMetadata } from '$lib/pageMetadata';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
  return pageMetadata.terms;
};
