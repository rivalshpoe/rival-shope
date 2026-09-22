import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { HomeExperience } from "@/components/home/HomeExperience";
import { getBrands } from "@/lib/api/endpoints/brands";
import { getCategories } from "@/lib/api/endpoints/categories";
import { queryKeys } from "@/lib/constants/query";
import { getQueryClient } from "@/providers/queryClient";

export const revalidate = 60;

export default async function HomePage() {
  const queryClient = getQueryClient();
  // Best-effort prefetch: failures fall through to client-side fetching with ErrorState.
  await Promise.allSettled([
    queryClient.prefetchQuery({ queryKey: queryKeys.categories, queryFn: () => getCategories() }),
    queryClient.prefetchQuery({ queryKey: queryKeys.brands, queryFn: () => getBrands() }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeExperience />
    </HydrationBoundary>
  );
}
