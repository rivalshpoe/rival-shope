import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CartDrawer } from "@/components/cart/CartExperience";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { ShopProvider } from "@/components/layout/ShopProvider";
import { QuickViewModal } from "@/components/product/ProductCard";
import { getCategories } from "@/lib/api/endpoints/categories";
import { queryKeys, STALE_TIMES } from "@/lib/constants/query";
import { getQueryClient } from "@/providers/queryClient";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  // The header reads categories before the page boundary. A pending query there
  // makes TanStack defer the page's dehydrated data until an effect, so the
  // server omits the hero image the browser then renders.
  await queryClient
    .prefetchQuery({
      queryKey: queryKeys.categories,
      queryFn: () => getCategories(),
      staleTime: STALE_TIMES.categories,
    })
    .catch(() => undefined);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ShopProvider>
        <div className="shop-shell">
          <Header />
          <main className="shop-main" id="main">{children}</main>
          <Footer />
        </div>
        <CartDrawer />
        <QuickViewModal />
      </ShopProvider>
    </HydrationBoundary>
  );
}
