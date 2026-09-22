import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetails } from "@/components/product/ProductDetails";
import { getEffectivePrice, getProduct } from "@/lib/api/endpoints/products";
import { isNotFoundError } from "@/lib/api/errors";
import type { ProductDetails as ProductDetailsData } from "@/types/api.types";

type Props = { params: Promise<{ id: string }> };

export const revalidate = 60;

/** `null` = not found; `undefined` = temporarily unavailable (client will retry). */
async function loadProduct(id: string): Promise<ProductDetailsData | null | undefined> {
  try {
    return await getProduct(id);
  } catch (error) {
    return isNotFoundError(error) ? null : undefined;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProduct(id);
  if (!product) return { title: "تفاصيل المنتج", description: "اكتشفي تفاصيل هذه القطعة المختارة من ريفال." };
  const primary = product.images.find((image) => image.isPrimary) ?? product.images[0];
  return {
    title: product.title,
    description: product.description.split("\n")[0].slice(0, 160),
    openGraph: primary ? { images: [primary.url] } : undefined,
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await loadProduct(id);
  if (product === null) notFound();

  const schema = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.title,
        image: product.images.map((image) => image.url),
        description: product.description,
        brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
        offers: {
          "@type": "Offer",
          priceCurrency: "ILS",
          price: getEffectivePrice(product),
          availability: product.stock > 0 || product.sizes.some((size) => size.inStock) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        },
      }
    : null;

  return (
    <>
      <ProductDetails id={id} initialProduct={product ?? undefined} />
      {schema && <script type="application/ld+json">{JSON.stringify(schema).replace(/</g, "\\u003c")}</script>}
    </>
  );
}
