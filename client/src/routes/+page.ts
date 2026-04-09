import { pageMetadata } from '$lib/pageMetadata';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = () => {
  return pageMetadata.home;
};
