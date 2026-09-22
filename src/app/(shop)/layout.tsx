import { CartDrawer } from "@/components/cart/CartExperience";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { ShopProvider } from "@/components/layout/ShopProvider";
import { QuickViewModal } from "@/components/product/ProductCard";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShopProvider>
      <div className="shop-shell">
        <Header />
        <main className="shop-main" id="main">{children}</main>
        <Footer />
      </div>
      <CartDrawer />
      <QuickViewModal />
    </ShopProvider>
  );
}
