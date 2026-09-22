import type {
  Brand,
  Category,
  DeliveryZone,
  Policy,
  ProductColor,
  ProductDetails,
  ProductListItem,
  ProductSize,
  Review,
} from "@/types/api.types";
import type {
  AdminDevice,
  AdminNotification,
  AdminOrderRecord,
  DiscountCode,
  InventoryRecord,
} from "@/types/domain.types";

/* -------------------------------------------------------------------------- */
/*  Imagery (Unsplash — allowed by next.config remotePatterns)                 */
/* -------------------------------------------------------------------------- */

const unsplash = (id: string, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;

export const mockImages = {
  bagBlack: unsplash("photo-1584917865442-de89df76afd3"),
  bagCream: unsplash("photo-1566150905458-1bf1fc113f0d"),
  bagGreen: unsplash("photo-1591561954557-26941169b49e"),
  bagMini: unsplash("photo-1594223274512-ad4803739b7c"),
  bagEditorial: unsplash("photo-1548036328-c9fa89d128fa"),
  bagTan: unsplash("photo-1548863227-3af567fc3b27"),
  bagRed: unsplash("photo-1590874103328-eac38a683ce7"),
  bagWhite: unsplash("photo-1559563458-527698bf5295"),
  bagBrown: unsplash("photo-1575032617751-6ddec2089882"),
  bagStreet: unsplash("photo-1601924994987-69e26d50dc26"),
  bagPink: unsplash("photo-1614179689702-355944cd0918"),
  bagStudio: unsplash("photo-1553062407-98eeb64c6a62"),
  glassesRound: unsplash("photo-1511499767150-a48a237f0083"),
  glassesCat: unsplash("photo-1572635196237-14b3f281503f"),
  glassesAviator: unsplash("photo-1508296695146-257a814070b4"),
  glassesBlack: unsplash("photo-1473496169904-658ba7c44d8a"),
  glassesGold: unsplash("photo-1577803645773-f96470509666"),
  glassesDark: unsplash("photo-1509695507497-903c140c43b0"),
  glassesTortoise: unsplash("photo-1556306535-0f09a537f0a3"),
  shapewearBeige: unsplash("photo-1596755389378-c31d21fd1273"),
  shapewearStudio: unsplash("photo-1594381898411-846e7d193883"),
  shapewearBlack: unsplash("photo-1550345332-09e3ac987658"),
  shapewearFit: unsplash("photo-1571019613454-1cb2f99b2d8b"),
  shapewearActive: unsplash("photo-1549476464-37392f717541"),
  jewelryGold: unsplash("photo-1617038220319-276d3cfab638"),
  jewelryPearl: unsplash("photo-1515562141207-7a88fb7ce338"),
  jewelryRing: unsplash("photo-1599643478518-a784e5dc4c8f"),
  jewelryEarrings: unsplash("photo-1573408301185-9146fe634ad0"),
  jewelryNecklace: unsplash("photo-1611591437281-460bfbe1220a"),
  jewelrySet: unsplash("photo-1535632066927-ab7c9ab60908"),
  scarfSilk: unsplash("photo-1601121141461-9d6647bca1ed"),
  silkPillow: unsplash("photo-1631005552268-213b1b1ee14b"),
  silkBedroom: unsplash("photo-1522771739844-6a9f6d5f14af"),
  silkLinen: unsplash("photo-1616594039964-ae9021a400a0"),
  silkBed: unsplash("photo-1540518614846-7eded433c457"),
  silkPillows: unsplash("photo-1584100936595-c0654b55a2e6"),
  heroPoster: unsplash("photo-1547887538-e3a2f32cb1cc", 2000),
  reviewScreenshot1: unsplash("photo-1512428559087-560fa5ceab42", 700),
  reviewScreenshot2: unsplash("photo-1483985988355-763728e1935b", 700),
  reviewScreenshot3: unsplash("photo-1490481651871-ab68de25d43d", 700),
} as const;

/* -------------------------------------------------------------------------- */
/*  Categories: 6 main categories + subcategories                              */
/* -------------------------------------------------------------------------- */

export const MAIN_CATEGORY_IDS = {
  brandBags: "cat-brand-bags",
  womenBags: "cat-women-bags",
  sunglasses: "cat-sunglasses",
  shapewear: "cat-shapewear",
  accessories: "cat-accessories",
  silk: "cat-silk",
} as const;

export const mockCategories: Category[] = [
  { id: "cat-brand-bags", name: "حقائب ماركات", slug: "brand-bags", imageUrl: mockImages.bagBlack, parentId: null, sortOrder: 1, isActive: true, productCount: 8 },
  { id: "cat-brand-bags-shoulder", name: "حقائب كتف ماركات", slug: "brand-shoulder-bags", imageUrl: mockImages.bagTan, parentId: "cat-brand-bags", sortOrder: 1, isActive: true, productCount: 4 },
  { id: "cat-brand-bags-crossbody", name: "حقائب كروس ماركات", slug: "brand-crossbody-bags", imageUrl: mockImages.bagMini, parentId: "cat-brand-bags", sortOrder: 2, isActive: true, productCount: 4 },

  { id: "cat-women-bags", name: "حقائب نسائية", slug: "women-bags", imageUrl: mockImages.bagCream, parentId: null, sortOrder: 2, isActive: true, productCount: 8 },
  { id: "cat-women-bags-tote", name: "حقائب توت يومية", slug: "tote-bags", imageUrl: mockImages.bagBrown, parentId: "cat-women-bags", sortOrder: 1, isActive: true, productCount: 4 },
  { id: "cat-women-bags-evening", name: "حقائب سهرة", slug: "evening-bags", imageUrl: mockImages.bagPink, parentId: "cat-women-bags", sortOrder: 2, isActive: true, productCount: 4 },

  { id: "cat-sunglasses", name: "نظارات شمسية ماركات", slug: "sunglasses", imageUrl: mockImages.glassesRound, parentId: null, sortOrder: 3, isActive: true, productCount: 7 },
  { id: "cat-sunglasses-cat-eye", name: "نظارات كات آي", slug: "cat-eye-sunglasses", imageUrl: mockImages.glassesCat, parentId: "cat-sunglasses", sortOrder: 1, isActive: true, productCount: 4 },
  { id: "cat-sunglasses-oversized", name: "نظارات أوفرسايز", slug: "oversized-sunglasses", imageUrl: mockImages.glassesBlack, parentId: "cat-sunglasses", sortOrder: 2, isActive: true, productCount: 3 },

  { id: "cat-shapewear", name: "مشدات النحت الكولومبية", slug: "colombian-shapewear", imageUrl: mockImages.shapewearBeige, parentId: null, sortOrder: 4, isActive: true, productCount: 6 },
  { id: "cat-shapewear-full", name: "مشدات جسم كامل", slug: "full-body-shapewear", imageUrl: mockImages.shapewearStudio, parentId: "cat-shapewear", sortOrder: 1, isActive: true, productCount: 3 },
  { id: "cat-shapewear-waist", name: "مشدات خصر", slug: "waist-trainers", imageUrl: mockImages.shapewearBlack, parentId: "cat-shapewear", sortOrder: 2, isActive: true, productCount: 3 },

  { id: "cat-accessories", name: "إكسسوارات", slug: "accessories", imageUrl: mockImages.jewelryGold, parentId: null, sortOrder: 5, isActive: true, productCount: 6 },
  { id: "cat-accessories-jewelry", name: "مجوهرات", slug: "jewelry", imageUrl: mockImages.jewelryPearl, parentId: "cat-accessories", sortOrder: 1, isActive: true, productCount: 4 },
  { id: "cat-accessories-scarves", name: "أوشحة وحجابات حرير", slug: "scarves", imageUrl: mockImages.scarfSilk, parentId: "cat-accessories", sortOrder: 2, isActive: true, productCount: 2 },

  { id: "cat-silk", name: "أغطية وسائد حرير للبشرة والشعر", slug: "silk-pillowcases", imageUrl: mockImages.silkPillow, parentId: null, sortOrder: 6, isActive: true, productCount: 5 },
  { id: "cat-silk-pillowcases", name: "أغطية وسائد حرير", slug: "silk-pillowcase-sets", imageUrl: mockImages.silkPillows, parentId: "cat-silk", sortOrder: 1, isActive: true, productCount: 3 },
  { id: "cat-silk-hair", name: "ربطات وأغطية شعر حرير", slug: "silk-hair-accessories", imageUrl: mockImages.silkBedroom, parentId: "cat-silk", sortOrder: 2, isActive: true, productCount: 2 },
];

/* -------------------------------------------------------------------------- */
/*  Brands                                                                     */
/* -------------------------------------------------------------------------- */

export const mockBrands: Brand[] = [
  { id: "brand-gucci", name: "Gucci", slug: "gucci", imageUrl: mockImages.bagGreen },
  { id: "brand-prada", name: "Prada", slug: "prada", imageUrl: mockImages.bagBlack },
  { id: "brand-dior", name: "Dior", slug: "dior", imageUrl: mockImages.bagCream },
  { id: "brand-chanel", name: "Chanel", slug: "chanel", imageUrl: mockImages.bagWhite },
  { id: "brand-saint-laurent", name: "Saint Laurent", slug: "saint-laurent", imageUrl: mockImages.glassesRound },
  { id: "brand-louis-vuitton", name: "Louis Vuitton", slug: "louis-vuitton", imageUrl: mockImages.bagBrown },
  { id: "brand-versace", name: "Versace", slug: "versace", imageUrl: mockImages.glassesGold },
  { id: "brand-michael-kors", name: "Michael Kors", slug: "michael-kors", imageUrl: mockImages.bagTan },
];

const brandRef = (id: string | null) => {
  if (!id) return null;
  const brand = mockBrands.find((candidate) => candidate.id === id);
  return brand ? { id: brand.id, name: brand.name, slug: brand.slug } : null;
};

/* -------------------------------------------------------------------------- */
/*  Products (~40)                                                             */
/* -------------------------------------------------------------------------- */

type SizeSeed = { label: string; price: number; stock: number };
type ColorSeed = { name: string; hex: string };

type ProductSeed = {
  id: string;
  slug: string;
  title: string;
  categoryId: string;
  brandId: string | null;
  price: number;
  discountPrice?: number;
  stock: number;
  images: string[];
  description: string;
  sizes?: SizeSeed[];
  colors?: ColorSeed[];
};

const shapewearSizes = (base: number, depleted: string[] = []): SizeSeed[] =>
  ["S", "M", "L", "XL", "2XL", "3XL"].map((label, index) => ({
    label,
    price: base + (index >= 4 ? 25 : 0),
    stock: depleted.includes(label) ? 0 : 6 + index,
  }));

const productSeeds: ProductSeed[] = [
  /* حقائب ماركات — كتف */
  { id: "prod-01", slug: "gucci-marmont-shoulder", title: "حقيبة غوتشي مارمونت الكتف", categoryId: "cat-brand-bags-shoulder", brandId: "brand-gucci", price: 2350, discountPrice: 2090, stock: 5, images: [mockImages.bagGreen, mockImages.bagEditorial, mockImages.bagStudio], description: "حقيبة كتف بجلد مبطن ناعم مع شعار GG المزدوج، وسلسلة معدنية ذهبية قابلة للتعديل. قطعة أيقونية تناسب النهار والمساء.", colors: [{ name: "أخضر زمردي", hex: "#2f5d4a" }, { name: "أسود", hex: "#141312" }] },
  { id: "prod-02", slug: "prada-galleria-saffiano", title: "حقيبة برادا غاليريا سافيانو", categoryId: "cat-brand-bags-shoulder", brandId: "brand-prada", price: 2680, stock: 3, images: [mockImages.bagBlack, mockImages.bagStudio], description: "جلد سافيانو المتين بلمسة برادا الكلاسيكية، مع مقبضين وحزام كتف قابل للفك. بطانة داخلية من النابا الفاخر.", colors: [{ name: "أسود", hex: "#141312" }, { name: "بيج", hex: "#d9c7ad" }] },
  { id: "prod-03", slug: "dior-lady-mini", title: "حقيبة ديور ليدي ميني", categoryId: "cat-brand-bags-shoulder", brandId: "brand-dior", price: 3150, discountPrice: 2890, stock: 2, images: [mockImages.bagCream, mockImages.bagWhite], description: "الحقيبة الأشهر بخياطة الكاناج المميزة وتعليقات D.I.O.R المعدنية. حجم ميني مثالي للإطلالات الراقية.", colors: [{ name: "عاجي", hex: "#efe6d8" }, { name: "وردي فاتح", hex: "#e8c9c9" }] },
  { id: "prod-04", slug: "chanel-classic-flap", title: "حقيبة شانيل كلاسيك فلاب", categoryId: "cat-brand-bags-shoulder", brandId: "brand-chanel", price: 4200, stock: 1, images: [mockImages.bagWhite, mockImages.bagBlack], description: "أيقونة دور الأزياء؛ جلد خروف مبطن بتصميم الماس، مع قفل CC وسلسلة متشابكة بالجلد.", colors: [{ name: "أبيض", hex: "#f3f1ec" }, { name: "أسود", hex: "#141312" }] },
  /* حقائب ماركات — كروس */
  { id: "prod-05", slug: "lv-pochette-metis", title: "حقيبة لوي فيتون بوشيت ميتيس", categoryId: "cat-brand-bags-crossbody", brandId: "brand-louis-vuitton", price: 2950, stock: 4, images: [mockImages.bagBrown, mockImages.bagTan], description: "حقيبة كروس بقماش مونوغرام الشهير وقفل S-lock، ثلاث مقصورات داخلية وحزام قابل للتعديل.", colors: [{ name: "مونوغرام", hex: "#6b4b2b" }] },
  { id: "prod-06", slug: "gucci-dionysus-mini", title: "حقيبة غوتشي ديونيسوس ميني", categoryId: "cat-brand-bags-crossbody", brandId: "brand-gucci", price: 2450, discountPrice: 2250, stock: 6, images: [mockImages.bagMini, mockImages.bagGreen], description: "قفل النمر المزدوج المميز، بجلد سويدي وقماش سوبريم، مع سلسلة كتف طويلة تتحول إلى كروس.", colors: [{ name: "أسود", hex: "#141312" }, { name: "أحمر", hex: "#8e2a2a" }] },
  { id: "prod-07", slug: "ysl-lou-camera-bag", title: "حقيبة سان لوران لو كاميرا", categoryId: "cat-brand-bags-crossbody", brandId: "brand-saint-laurent", price: 1980, stock: 7, images: [mockImages.bagRed, mockImages.bagStreet], description: "حقيبة كاميرا مبطنة بنمط شيفرون مع شعار YSL الذهبي، خفيفة وعملية لكل يوم.", colors: [{ name: "أحمر داكن", hex: "#7a1f24" }, { name: "أسود", hex: "#141312" }] },
  { id: "prod-08", slug: "michael-kors-jet-set-crossbody", title: "حقيبة مايكل كورس جيت سيت كروس", categoryId: "cat-brand-bags-crossbody", brandId: "brand-michael-kors", price: 890, discountPrice: 749, stock: 12, images: [mockImages.bagTan, mockImages.bagStreet], description: "جلد سافيانو بمقاومة عالية للخدوش، حزام قابل للتعديل وسحاب علوي. مثالية للسفر والتنقل اليومي.", colors: [{ name: "كاميل", hex: "#b48a5a" }, { name: "أسود", hex: "#141312" }, { name: "أبيض", hex: "#f3f1ec" }] },

  /* حقائب نسائية — توت */
  { id: "prod-09", slug: "rival-valentina-tote", title: "حقيبة ڤالنتينا توت الجلدية", categoryId: "cat-women-bags-tote", brandId: null, price: 480, discountPrice: 399, stock: 15, images: [mockImages.bagBlack, mockImages.bagStudio], description: "حقيبة توت بهيكل معماري وجلد ناعم، تتسع للحاسوب اللوحي وكل احتياجات يومكِ بسلاسة.", colors: [{ name: "أسود", hex: "#151411" }, { name: "عسلي", hex: "#9a6442" }] },
  { id: "prod-10", slug: "rival-luna-cream-tote", title: "حقيبة لونا الكريمية", categoryId: "cat-women-bags-tote", brandId: null, price: 520, stock: 9, images: [mockImages.bagCream, mockImages.bagWhite], description: "درجة كريمية دافئة، جلد نباتي فاخر بملمس حريري وحزام كتف عريض مريح.", colors: [{ name: "عاجي", hex: "#e9dfcf" }, { name: "موكا", hex: "#67564a" }] },
  { id: "prod-11", slug: "rival-amber-work-tote", title: "حقيبة أمبر للعمل", categoryId: "cat-women-bags-tote", brandId: null, price: 560, stock: 8, images: [mockImages.bagBrown, mockImages.bagEditorial], description: "تصميم مهني بجيوب منظمة، مقاس يناسب لابتوب 14 بوصة، مع قاعدة معززة تحافظ على الشكل.", colors: [{ name: "بني", hex: "#5b3a22" }, { name: "أسود", hex: "#151411" }] },
  { id: "prod-12", slug: "rival-sahara-woven-tote", title: "حقيبة صحارى المنسوجة", categoryId: "cat-women-bags-tote", brandId: null, price: 390, discountPrice: 329, stock: 11, images: [mockImages.bagTan, mockImages.bagStreet], description: "جلد منسوج يدويًا بلون الرمال، خفيفة ومناسبة لأيام الصيف والرحلات.", colors: [{ name: "رملي", hex: "#c9ad86" }] },
  /* حقائب نسائية — سهرة */
  { id: "prod-13", slug: "rival-nova-evening-clutch", title: "حقيبة نوفا المسائية", categoryId: "cat-women-bags-evening", brandId: null, price: 430, stock: 6, images: [mockImages.bagMini, mockImages.bagPink], description: "كلاتش مسائي بقفل معدني مصقول وسلسلة رفيعة قابلة للإخفاء، لإطلالات السهرة.", colors: [{ name: "ذهبي", hex: "#c8a15a" }, { name: "أسود", hex: "#151411" }] },
  { id: "prod-14", slug: "rival-rose-satin-bag", title: "حقيبة روز الساتان", categoryId: "cat-women-bags-evening", brandId: null, price: 360, discountPrice: 299, stock: 10, images: [mockImages.bagPink, mockImages.bagMini], description: "ساتان وردي بلمعة هادئة مع مقبض علوي مرصّع، صُممت لتكمل فساتين المناسبات.", colors: [{ name: "وردي", hex: "#e3b7c4" }, { name: "شامبانيا", hex: "#e2cbaa" }] },
  { id: "prod-15", slug: "rival-noir-mini-chain", title: "حقيبة نوار ميني بالسلسلة", categoryId: "cat-women-bags-evening", brandId: null, price: 410, stock: 7, images: [mockImages.bagBlack, mockImages.bagStudio], description: "حقيبة صغيرة بجلد لامع وسلسلة ذهبية، تتسع للهاتف وأساسيات المساء.", colors: [{ name: "أسود", hex: "#151411" }] },
  { id: "prod-16", slug: "rival-pearl-box-bag", title: "حقيبة بيرل بوكس", categoryId: "cat-women-bags-evening", brandId: null, price: 470, stock: 4, images: [mockImages.bagWhite, mockImages.bagCream], description: "هيكل صندوقي بحواف ناعمة ومقبض لؤلؤي، اختيار العروس والمناسبات الراقية.", colors: [{ name: "لؤلؤي", hex: "#efe9df" }] },

  /* نظارات — كات آي */
  { id: "prod-17", slug: "dior-signature-cat-eye", title: "نظارة ديور سيجنتشر كات آي", categoryId: "cat-sunglasses-cat-eye", brandId: "brand-dior", price: 1450, discountPrice: 1290, stock: 5, images: [mockImages.glassesCat, mockImages.glassesBlack], description: "إطار كات آي من الأسيتات مع توقيع CD على الذراعين وعدسات متدرجة بحماية UV400.", colors: [{ name: "أسود", hex: "#161616" }, { name: "هافانا", hex: "#805c3b" }] },
  { id: "prod-18", slug: "ysl-loulou-cat-eye", title: "نظارة سان لوران لولو", categoryId: "cat-sunglasses-cat-eye", brandId: "brand-saint-laurent", price: 1280, stock: 6, images: [mockImages.glassesRound, mockImages.glassesDark], description: "خطوط كات آي حادة مع شعار YSL الذهبي، عدسات داكنة تمنحكِ حضورًا أنيقًا.", colors: [{ name: "أسود", hex: "#161616" }] },
  { id: "prod-19", slug: "prada-symbole-cat-eye", title: "نظارة برادا سيمبول", categoryId: "cat-sunglasses-cat-eye", brandId: "brand-prada", price: 1390, stock: 4, images: [mockImages.glassesBlack, mockImages.glassesCat], description: "تصميم هندسي جريء بشعار المثلث المميز، إطار أسيتات وعدسات UV400.", colors: [{ name: "أسود", hex: "#161616" }, { name: "أبيض", hex: "#f4f2ee" }] },
  { id: "prod-20", slug: "gucci-crystal-cat-eye", title: "نظارة غوتشي كريستال كات آي", categoryId: "cat-sunglasses-cat-eye", brandId: "brand-gucci", price: 1520, discountPrice: 1350, stock: 3, images: [mockImages.glassesGold, mockImages.glassesRound], description: "إطار مرصّع بالكريستال على الأطراف، لمسة استعراضية بروح غوتشي.", colors: [{ name: "ذهبي", hex: "#c8a15a" }] },
  /* نظارات — أوفرسايز */
  { id: "prod-21", slug: "versace-medusa-oversized", title: "نظارة فيرساتشي ميدوسا أوفرسايز", categoryId: "cat-sunglasses-oversized", brandId: "brand-versace", price: 1180, discountPrice: 990, stock: 8, images: [mockImages.glassesGold, mockImages.glassesAviator], description: "إطار كبير بشعار ميدوسا الذهبي على الجانبين، عدسات متدرجة تحمي من الأشعة فوق البنفسجية.", colors: [{ name: "ذهبي/بني", hex: "#8b6a3d" }, { name: "أسود", hex: "#161616" }] },
  { id: "prod-22", slug: "chanel-square-oversized", title: "نظارة شانيل مربعة أوفرسايز", categoryId: "cat-sunglasses-oversized", brandId: "brand-chanel", price: 1650, stock: 2, images: [mockImages.glassesBlack, mockImages.glassesDark], description: "إطار مربع كبير مع شعار CC اللؤلؤي، تصميم كلاسيكي لا يفقد أناقته.", colors: [{ name: "أسود", hex: "#161616" }] },
  { id: "prod-23", slug: "michael-kors-tortoise-oversized", title: "نظارة مايكل كورس تورتويز", categoryId: "cat-sunglasses-oversized", brandId: "brand-michael-kors", price: 620, discountPrice: 529, stock: 14, images: [mockImages.glassesTortoise, mockImages.glassesAviator], description: "إطار تورتويز دافئ بعدسات بنية متدرجة، خفيفة ومريحة للارتداء اليومي.", colors: [{ name: "تورتويز", hex: "#7c4f2b" }] },

  /* مشدات — جسم كامل */
  { id: "prod-24", slug: "colombian-sculpt-360-full-body", title: "مشد كولومبي Sculpt 360 جسم كامل", categoryId: "cat-shapewear-full", brandId: null, price: 390, discountPrice: 349, stock: 40, images: [mockImages.shapewearBeige, mockImages.shapewearStudio], description: "مشد كولومبي أصلي بضغط عالٍ ومتوازن، يشدّ البطن والخصر والأرداف مع ثلاث مستويات من الخطافات. قماش Powernet يسمح بمرور الهواء.", sizes: shapewearSizes(349, ["S"]), colors: [{ name: "بيج", hex: "#d8b99a" }, { name: "أسود", hex: "#141312" }] },
  { id: "prod-25", slug: "colombian-post-surgery-bodysuit", title: "مشد كولومبي ما بعد العمليات", categoryId: "cat-shapewear-full", brandId: null, price: 460, stock: 25, images: [mockImages.shapewearStudio, mockImages.shapewearBeige], description: "مصمم للمرحلة الثانية بعد عمليات النحت، بأكمام قصيرة وفتحة سفلية وقماش طبي ناعم على البشرة.", sizes: shapewearSizes(460), colors: [{ name: "بيج", hex: "#d8b99a" }, { name: "أسود", hex: "#141312" }] },
  { id: "prod-26", slug: "colombian-seamless-shaping-bodysuit", title: "بودي سوت نحت بلا خياطة", categoryId: "cat-shapewear-full", brandId: null, price: 320, discountPrice: 279, stock: 30, images: [mockImages.shapewearBlack, mockImages.shapewearFit], description: "بودي سوت بلا خياطة يختفي تحت الملابس، ضغط متوسط مريح ليوم كامل مع دعم للصدر.", sizes: shapewearSizes(279, ["3XL"]), colors: [{ name: "أسود", hex: "#141312" }, { name: "بيج", hex: "#d8b99a" }] },
  /* مشدات — خصر */
  { id: "prod-27", slug: "colombian-latex-waist-trainer", title: "مشد خصر كولومبي لاتكس", categoryId: "cat-shapewear-waist", brandId: null, price: 280, stock: 35, images: [mockImages.shapewearBlack, mockImages.shapewearActive], description: "لاتكس كولومبي بثلاثة صفوف من الخطافات و9 دعامات مرنة، يشد الخصر ويدعم الظهر أثناء التمرين.", sizes: shapewearSizes(280), colors: [{ name: "أسود", hex: "#141312" }] },
  { id: "prod-28", slug: "colombian-daily-waist-cincher", title: "مشد خصر يومي خفيف", categoryId: "cat-shapewear-waist", brandId: null, price: 210, discountPrice: 179, stock: 28, images: [mockImages.shapewearFit, mockImages.shapewearBeige], description: "مشد خفيف الوزن بضغط لطيف للارتداء اليومي تحت الملابس، بلا دعامات معدنية.", sizes: shapewearSizes(179), colors: [{ name: "بيج", hex: "#d8b99a" }, { name: "أسود", hex: "#141312" }] },
  { id: "prod-29", slug: "colombian-high-waist-shaping-shorts", title: "شورت نحت كولومبي عالي الخصر", categoryId: "cat-shapewear-waist", brandId: null, price: 240, stock: 22, images: [mockImages.shapewearActive, mockImages.shapewearStudio], description: "شورت نحت عالي الخصر يرفع الأرداف ويشدّ الفخذين، مع حزام سيليكون يمنع الانزلاق.", sizes: shapewearSizes(240, ["2XL", "3XL"]), colors: [{ name: "أسود", hex: "#141312" }, { name: "بيج", hex: "#d8b99a" }] },

  /* إكسسوارات — مجوهرات */
  { id: "prod-30", slug: "aura-gold-hoop-earrings", title: "أقراط أورا الذهبية", categoryId: "cat-accessories-jewelry", brandId: null, price: 145, stock: 30, images: [mockImages.jewelryEarrings, mockImages.jewelryGold], description: "أقراط حلقية مطلية بالذهب عيار 18، خفيفة ومضادة للحساسية.", colors: [{ name: "ذهبي", hex: "#c8a15a" }, { name: "فضي", hex: "#c9c9c9" }] },
  { id: "prod-31", slug: "pearl-drop-necklace", title: "عقد لؤلؤ متدلي", categoryId: "cat-accessories-jewelry", brandId: null, price: 240, discountPrice: 199, stock: 18, images: [mockImages.jewelryPearl, mockImages.jewelryNecklace], description: "عقد رفيع بلؤلؤة مياه عذبة طبيعية وسلسلة قابلة للتعديل.", colors: [{ name: "ذهبي", hex: "#c8a15a" }] },
  { id: "prod-32", slug: "stacking-rings-set", title: "طقم خواتم متراكبة", categoryId: "cat-accessories-jewelry", brandId: null, price: 175, stock: 20, images: [mockImages.jewelryRing, mockImages.jewelrySet], description: "ثلاثة خواتم رفيعة بتصاميم متناغمة تُلبس معًا أو منفردة، طلاء ذهبي مقاوم للتأكسد.", sizes: [{ label: "6", price: 175, stock: 6 }, { label: "7", price: 175, stock: 8 }, { label: "8", price: 175, stock: 0 }], colors: [{ name: "ذهبي", hex: "#c8a15a" }] },
  { id: "prod-33", slug: "crystal-statement-necklace", title: "عقد كريستال فاخر", categoryId: "cat-accessories-jewelry", brandId: null, price: 315, stock: 9, images: [mockImages.jewelryNecklace, mockImages.jewelrySet], description: "عقد سهرة مرصّع بالكريستال النمساوي، يمنح الرقبة إشراقة ملكية.", colors: [{ name: "فضي", hex: "#c9c9c9" }] },
  /* إكسسوارات — أوشحة */
  { id: "prod-34", slug: "silk-twill-scarf-champagne", title: "وشاح حرير تويل شامبانيا", categoryId: "cat-accessories-scarves", brandId: null, price: 220, discountPrice: 189, stock: 16, images: [mockImages.scarfSilk, mockImages.silkPillow], description: "وشاح حرير تويل 100% بحواف مطوية يدويًا، لون شامبانيا يناسب كل الإطلالات.", colors: [{ name: "شامبانيا", hex: "#e2cbaa" }, { name: "أسود", hex: "#141312" }] },
  { id: "prod-35", slug: "silk-square-hijab", title: "حجاب حرير مربع", categoryId: "cat-accessories-scarves", brandId: null, price: 260, stock: 14, images: [mockImages.silkLinen, mockImages.scarfSilk], description: "حجاب حرير طبيعي بمقاس 110×110 سم، انسدال ناعم ولمعة راقية.", colors: [{ name: "عاجي", hex: "#efe6d8" }, { name: "زيتي", hex: "#5b6b4a" }, { name: "أسود", hex: "#141312" }] },

  /* حرير — أغطية وسائد */
  { id: "prod-36", slug: "royal-mulberry-silk-pillowcase", title: "غطاء وسادة حرير مولبيري ملكي", categoryId: "cat-silk-pillowcases", brandId: null, price: 195, stock: 40, images: [mockImages.silkPillow, mockImages.silkBedroom], description: "حرير مولبيري 22 مومي من الدرجة 6A، يحافظ على رطوبة البشرة ويمنع تكسّر الشعر أثناء النوم. سحاب مخفي.", sizes: [{ label: "ستاندرد 50×75", price: 195, stock: 20 }, { label: "كينغ 50×90", price: 235, stock: 12 }], colors: [{ name: "شامبانيا", hex: "#ceb38f" }, { name: "لؤلؤي", hex: "#eee9df" }, { name: "رمادي", hex: "#9a9a9a" }] },
  { id: "prod-37", slug: "silk-pillowcase-duo-set", title: "طقم غطاءَي وسادة حرير", categoryId: "cat-silk-pillowcases", brandId: null, price: 360, discountPrice: 299, stock: 22, images: [mockImages.silkPillows, mockImages.silkBed], description: "طقم من غطاءين بحرير مولبيري 22 مومي في علبة هدايا أنيقة.", sizes: [{ label: "ستاندرد", price: 299, stock: 14 }, { label: "كينغ", price: 349, stock: 8 }], colors: [{ name: "شامبانيا", hex: "#ceb38f" }, { name: "أزرق باودر", hex: "#b9c6d6" }] },
  { id: "prod-38", slug: "silk-eye-mask-pillowcase-gift-set", title: "طقم هدية: غطاء وسادة وقناع عيون حرير", categoryId: "cat-silk-pillowcases", brandId: null, price: 290, stock: 15, images: [mockImages.silkBedroom, mockImages.silkPillow], description: "غطاء وسادة وقناع عيون من الحرير نفسه، في علبة هدايا فاخرة تناسب المناسبات.", colors: [{ name: "لؤلؤي", hex: "#eee9df" }, { name: "وردي", hex: "#e3b7c4" }] },
  /* حرير — شعر */
  { id: "prod-39", slug: "silk-scrunchies-set", title: "طقم ربطات شعر حرير", categoryId: "cat-silk-hair", brandId: null, price: 95, discountPrice: 79, stock: 50, images: [mockImages.scarfSilk, mockImages.silkLinen], description: "ثلاث ربطات شعر من حرير مولبيري تمنع التكسّر والتجعّد، بألوان محايدة.", colors: [{ name: "متعدد", hex: "#d9c4aa" }] },
  { id: "prod-40", slug: "silk-sleep-bonnet", title: "غطاء شعر حرير للنوم", categoryId: "cat-silk-hair", brandId: null, price: 140, stock: 26, images: [mockImages.silkLinen, mockImages.silkBedroom], description: "بونيه حرير مبطن بحزام مرن مريح يحافظ على تسريحتكِ ورطوبة شعركِ طوال الليل.", colors: [{ name: "شامبانيا", hex: "#ceb38f" }, { name: "أسود", hex: "#141312" }] },
];

const categoryById = new Map(mockCategories.map((category) => [category.id, category]));

export function getMockCategoryPath(categoryId: string): Category[] {
  const path: Category[] = [];
  let current = categoryById.get(categoryId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? categoryById.get(current.parentId) : undefined;
  }
  return path;
}

export const mockProducts: ProductListItem[] = productSeeds.map((seed) => {
  const brand = brandRef(seed.brandId);
  return {
    id: seed.id,
    title: seed.title,
    slug: seed.slug,
    primaryImageUrl: seed.images[0],
    price: seed.price,
    discountPrice: seed.discountPrice ?? null,
    isDiscountActive: seed.discountPrice !== undefined,
    hasSizes: Boolean(seed.sizes?.length),
    hasColors: Boolean(seed.colors?.length),
    categoryId: seed.categoryId,
    brandId: brand?.id ?? null,
    brandName: brand?.name ?? null,
    brandSlug: brand?.slug ?? null,
  };
});

export const mockProductDetails: ProductDetails[] = productSeeds.map((seed) => {
  const category = categoryById.get(seed.categoryId);
  const sizes: ProductSize[] = (seed.sizes ?? []).map((size, index) => ({
    id: `${seed.id}-size-${index + 1}`,
    label: size.label,
    price: size.price,
    inStock: size.stock > 0,
  }));
  const colors: ProductColor[] = (seed.colors ?? []).map((color, index) => ({
    id: `${seed.id}-color-${index + 1}`,
    name: color.name,
    hex: color.hex,
  }));
  const related = productSeeds
    .filter((candidate) => candidate.id !== seed.id)
    .sort((a, b) => {
      const sameA = a.categoryId === seed.categoryId ? 0 : getMockCategoryPath(a.categoryId)[0]?.id === getMockCategoryPath(seed.categoryId)[0]?.id ? 1 : 2;
      const sameB = b.categoryId === seed.categoryId ? 0 : getMockCategoryPath(b.categoryId)[0]?.id === getMockCategoryPath(seed.categoryId)[0]?.id ? 1 : 2;
      return sameA - sameB;
    })
    .slice(0, 4)
    .map((candidate) => candidate.id);

  return {
    id: seed.id,
    title: seed.title,
    slug: seed.slug,
    description: seed.description,
    images: seed.images.map((url, index) => ({ url, isPrimary: index === 0, sortOrder: index + 1 })),
    colors,
    sizes,
    price: seed.price,
    discountPrice: seed.discountPrice ?? null,
    isDiscountActive: seed.discountPrice !== undefined,
    stock: seed.sizes ? seed.sizes.reduce((total, size) => total + size.stock, 0) : seed.stock,
    categoryId: seed.categoryId,
    categoryName: category?.name ?? "",
    categorySlug: category?.slug ?? "",
    brand: brandRef(seed.brandId),
    relatedProductIds: related,
  };
});

/* -------------------------------------------------------------------------- */
/*  Policies                                                                   */
/* -------------------------------------------------------------------------- */

export const mockPolicies: Policy[] = [
  {
    key: "order",
    title: "سياسة الطلب والتوصيل",
    updatedAt: "2026-09-01T09:00:00Z",
    content: `## كيف يتم الطلب؟
اختاري القطع التي تحبينها وأضيفيها إلى الحقيبة، ثم أتمّي الطلب بإدخال اسمكِ ورقم واتساب فعّال وعنوان التوصيل إن رغبتِ بذلك. لا نطلب إنشاء حساب أو بريدًا إلكترونيًا.

## تأكيد الطلب
بعد إرسال الطلب يظهر لكِ رقم الفاتورة فورًا، ويتواصل فريق ريفال معكِ عبر واتساب خلال ساعات العمل لتأكيد القطع والعنوان والتكلفة النهائية. لا يُعتبر الطلب مؤكدًا قبل هذا التواصل.

## مواعيد ورسوم التوصيل
تختلف مدة التوصيل ورسومه حسب المنطقة التي تختارينها أثناء إتمام الطلب. تظهر الرسوم قبل تأكيد الطلب، وتستغرق مدة التوصيل عادةً من يومَي عمل إلى خمسة أيام عمل. قد تتأخر المواعيد في العطل الرسمية أو الظروف الخارجة عن السيطرة.

## الدفع
الدفع عند الاستلام نقدًا هو وسيلة الدفع المتاحة حاليًا. يُرجى تجهيز المبلغ المتفق عليه عند وصول الطلب.

## فحص الطلب عند الاستلام
نراجع كل قطعة بعناية قبل تغليفها. عند الاستلام، نوصي بالتأكد من سلامة التغليف والقطع والتواصل معنا فورًا عند وجود أي ملاحظة.`,
  },
  {
    key: "cancellation",
    title: "سياسة إلغاء الطلب",
    updatedAt: "2026-09-01T09:00:00Z",
    content: `## قبل تأكيد الطلب
يمكنكِ إلغاء الطلب مجانًا في أي وقت قبل تأكيده معنا عبر واتساب، بمجرد إرسال رسالة تحمل رقم الفاتورة.

## بعد التأكيد وقبل الشحن
تواصلي معنا بأسرع وقت. إذا لم يخرج الطلب للتوصيل بعد، سنقوم بإلغائه أو تعديل القطع دون أي رسوم.

## بعد خروج الطلب للتوصيل
عند خروج الطلب للتوصيل، قد يتعذر الإلغاء أو تُحتسب رسوم التوصيل الفعلية على العميلة. يوضح فريقنا الحالة قبل اتخاذ أي إجراء.

## الطلبات الخاصة
القطع التي تُطلب خصيصًا أو تُجهّز حسب الطلب (مثل المقاسات الخاصة أو التغليف المخصص) لا يمكن إلغاؤها بعد بدء التجهيز، ما لم يوجد عيب مؤكد.`,
  },
  {
    key: "returns",
    title: "سياسة الاستبدال والإرجاع",
    updatedAt: "2026-09-01T09:00:00Z",
    content: `## شروط قبول الطلب
يُقبل الاستبدال خلال 3 أيام من الاستلام بشرط أن تكون القطعة بحالتها الأصلية، غير مستخدمة، مع التغليف والبطاقات كاملة وإرسال صورة واضحة عبر واتساب.

## الفئات المستثناة
حرصًا على السلامة والنظافة، لا تُستبدل ولا تُرجع المنتجات الشخصية مثل المشدات وأغطية الوسائد وربطات الشعر والمجوهرات بعد فتح التغليف، إلا عند وجود عيب مصنعي مؤكد.

## وجود عيب أو خطأ
إذا وصلتكِ قطعة مختلفة عن طلبكِ أو بها عيب مصنعي، تواصلي معنا خلال 48 ساعة مع صور واضحة. سنوفر الاستبدال أو الحل المناسب دون تحميلكِ أي تكلفة إضافية.

## رسوم الاستبدال
في حالات تغيير الرأي أو المقاس، تتحمل العميلة رسوم التوصيل ذهابًا وإيابًا. يُشترط توفر البديل قبل استلام القطعة الأصلية.

## المبالغ المستردة
بما أن الدفع يتم عند الاستلام، تُستبدل القطعة بأخرى أو بقيمة شرائية معادلة تُستخدم في طلب لاحق.`,
  },
  {
    key: "shipping",
    title: "سياسة الشحن والتوصيل",
    updatedAt: "2026-09-01T09:00:00Z",
    content: `## مناطق التوصيل
نوصل إلى جميع مناطق الضفة الغربية والقدس والداخل حسب المناطق المتاحة عند إتمام الطلب. يمكنكِ أيضًا اختيار عدم الحاجة للتوصيل والتنسيق للاستلام مباشرة.

## مدة التوصيل
تستغرق الطلبات داخل رام الله والبيرة يومًا إلى يومَي عمل، والمناطق الأخرى من يومين إلى خمسة أيام عمل بعد التأكيد. تصلكِ رسالة واتساب عند خروج الطلب للتوصيل.

## رسوم التوصيل
تُحدد الرسوم حسب المنطقة وتظهر بوضوح في ملخص الطلب قبل التأكيد. قد تُطبَّق عروض توصيل مجاني في مناسبات محددة ويُعلن عنها في الموقع.

## التغليف
تُغلّف كل قطعة في تغليف ريفال الفاخر مع بطاقة شكر، ويُمكن طلب تغليف هدايا بالتنسيق مع فريقنا عبر واتساب.

## تعذّر التسليم
إذا تعذّر الوصول إليكِ على الرقم المسجل خلال محاولتين، يُعاد الطلب إلينا ويُعتبر ملغيًا، ونتواصل معكِ لإعادة الترتيب عند الرغبة.`,
  },
  {
    key: "privacy",
    title: "سياسة الخصوصية",
    updatedAt: "2026-09-01T09:00:00Z",
    content: `## البيانات التي نجمعها
نجمع فقط ما نحتاجه لإتمام طلبكِ: الاسم، رقم واتساب، وعنوان التوصيل إن اخترتِ التوصيل. لا نطلب بيانات دفع أو بطاقات بنكية.

## كيف نستخدم بياناتكِ
تُستخدم البيانات لتأكيد الطلب والتواصل معكِ بشأنه وتوصيله فقط. لا نرسل رسائل تسويقية إلا بموافقتكِ الصريحة.

## حماية من الطلبات الوهمية
لحمايتكِ وحماية المتجر، نستخدم معرّفًا تقنيًا مجهّلًا للجهاز للحد من الطلبات الوهمية المتكررة. لا يحتوي هذا المعرّف على أي بيانات شخصية قابلة للتعريف.

## مشاركة البيانات
لا نبيع بياناتكِ ولا نشاركها مع أطراف ثالثة، باستثناء شركة التوصيل وبالحد الأدنى اللازم لإتمام التسليم.

## التخزين المحلي
يحتفظ المتصفح محليًا بمحتوى الحقيبة والمفضلة وبيانات إتمام الطلب لتسهيل تجربتكِ عند العودة، ويمكنكِ حذفها في أي وقت من إعدادات المتصفح.

## حقوقكِ
يمكنكِ طلب تعديل بياناتكِ أو حذفها بالتواصل معنا عبر واتساب في أي وقت.`,
  },
];

/* -------------------------------------------------------------------------- */
/*  Reviews (approved only in the public feed)                                 */
/* -------------------------------------------------------------------------- */

export const mockReviews: Review[] = [
  { id: "review-01", customerName: "ليان م.", rating: 5, comment: "الحقيبة وصلت بتغليف فاخر جدًا والخامة أفضل من الصور. التواصل عبر واتساب كان سريعًا ومحترمًا.", imageUrl: mockImages.reviewScreenshot1, productId: "prod-01", productTitle: "حقيبة غوتشي مارمونت الكتف", createdAt: "2026-09-15T10:00:00Z" },
  { id: "review-02", customerName: "نور ع.", rating: 5, comment: "المشد الكولومبي مريح فعلًا ومقاسه مضبوط حسب الجدول. ساعدوني باختيار المقاس قبل الطلب.", imageUrl: mockImages.reviewScreenshot2, productId: "prod-24", productTitle: "مشد كولومبي Sculpt 360 جسم كامل", createdAt: "2026-09-17T13:30:00Z" },
  { id: "review-03", customerName: "سارة خ.", rating: 4, comment: "النظارة أصلية وجميلة، التوصيل تأخر يومًا عن الموعد لكن أعلموني مسبقًا.", imageUrl: null, productId: "prod-21", productTitle: "نظارة فيرساتشي ميدوسا أوفرسايز", createdAt: "2026-09-18T08:15:00Z" },
  { id: "review-04", customerName: "ريم ح.", rating: 5, comment: "غطاء الوسادة الحرير غيّر شعري فعلًا، ما عاد يتجعد في الصباح. اشتريت طقمًا ثانيًا كهدية.", imageUrl: mockImages.reviewScreenshot3, productId: "prod-36", productTitle: "غطاء وسادة حرير مولبيري ملكي", createdAt: "2026-09-19T16:45:00Z" },
  { id: "review-05", customerName: "هدى ن.", rating: 5, comment: "تجربة شراء راقية من البداية للنهاية. حقيبة لونا أجمل بكثير على الطبيعة.", imageUrl: null, productId: "prod-10", productTitle: "حقيبة لونا الكريمية", createdAt: "2026-09-19T19:20:00Z" },
  { id: "review-06", customerName: "ميس أ.", rating: 4, comment: "الأقراط خفيفة وأنيقة ولم تسبب أي حساسية. أتمنى توفير ألوان أكثر.", imageUrl: null, productId: "prod-30", productTitle: "أقراط أورا الذهبية", createdAt: "2026-09-20T11:05:00Z" },
  { id: "review-07", customerName: "جنى ك.", rating: 5, comment: "أفضل متجر تعاملت معه، صادقين بالمواصفات ويتابعون بعد الاستلام.", imageUrl: null, productId: null, productTitle: null, createdAt: "2026-09-20T18:40:00Z" },
  { id: "review-08", customerName: "دانا س.", rating: 5, comment: "الوشاح الحريري فخم وملمسه ناعم جدًا، وصلني خلال يومين إلى القدس.", imageUrl: null, productId: "prod-34", productTitle: "وشاح حرير تويل شامبانيا", createdAt: "2026-09-21T09:30:00Z" },
];

/* -------------------------------------------------------------------------- */
/*  Delivery zones & discount codes                                            */
/* -------------------------------------------------------------------------- */

export const mockDeliveryZones: DeliveryZone[] = [
  { id: "zone-ramallah", name: "رام الله والبيرة", extraFee: 20, isActive: true },
  { id: "zone-jerusalem", name: "القدس وضواحيها", extraFee: 30, isActive: true },
  { id: "zone-north", name: "شمال الضفة (نابلس، جنين، طولكرم، قلقيلية)", extraFee: 35, isActive: true },
  { id: "zone-south", name: "جنوب الضفة (بيت لحم، الخليل)", extraFee: 35, isActive: true },
  { id: "zone-48", name: "الداخل الفلسطيني", extraFee: 70, isActive: true },
  { id: "zone-pickup", name: "استلام من المكتب — رام الله", extraFee: null, isActive: true },
];

export const mockDiscountCodes: DiscountCode[] = [
  { id: "discount-1", code: "RIVAL10", type: "percentage", value: 10, isActive: true, expiresAt: null },
  { id: "discount-2", code: "WELCOME15", type: "percentage", value: 15, isActive: true, expiresAt: "2027-01-01T00:00:00Z" },
  { id: "discount-3", code: "LUXURY50", type: "fixed", value: 50, isActive: true, expiresAt: "2027-01-01T00:00:00Z" },
];

/* -------------------------------------------------------------------------- */
/*  Legacy admin fixtures (kept for the admin endpoints that still import them) */
/* -------------------------------------------------------------------------- */

export const mockAdminOrders: AdminOrderRecord[] = [
  { id: "order-1", invoiceNumber: "RIV-260921-001", customerName: "هدى منصور", phoneNumber: "599123456", total: 2139, status: "Pending", itemCount: 2, createdAt: "2026-09-21T09:10:00Z" },
  { id: "order-2", invoiceNumber: "RIV-260920-014", customerName: "ميس أبو عيشة", phoneNumber: "568456789", total: 1020, status: "Shipped", itemCount: 1, createdAt: "2026-09-20T14:20:00Z" },
  { id: "order-3", invoiceNumber: "RIV-260919-009", customerName: "رنا خليل", phoneNumber: "598765432", total: 648, status: "Delivered", itemCount: 2, createdAt: "2026-09-19T11:45:00Z" },
];

export const mockInventory: InventoryRecord[] = [
  { id: "inv-1", productId: "prod-01", change: 12, stockAfter: 12, reason: "restock", createdAt: "2026-09-01T08:00:00Z" },
  { id: "inv-2", productId: "prod-01", change: -1, stockAfter: 11, reason: "sale", createdAt: "2026-09-21T09:10:00Z" },
  { id: "inv-3", productId: "prod-24", change: 40, stockAfter: 40, reason: "restock", createdAt: "2026-09-05T08:00:00Z" },
];

export const mockAdminDevices: AdminDevice[] = [
  { id: "device-1", fingerprint: "demo-a1b2c3", orderCountLastHour: 1, isBlocked: false, lastSeenAt: "2026-09-22T10:10:00Z" },
  { id: "device-2", fingerprint: "demo-d4e5f6", orderCountLastHour: 3, isBlocked: false, lastSeenAt: "2026-09-22T10:05:00Z" },
  { id: "device-3", fingerprint: "demo-risk-01", orderCountLastHour: 7, isBlocked: true, lastSeenAt: "2026-09-22T09:40:00Z" },
];

export const mockAdminNotifications: AdminNotification[] = [
  { id: "notification-1", title: "طلب جديد", message: "تم استلام طلب جديد بانتظار التأكيد.", orderId: "order-1", isResolved: false, createdAt: "2026-09-21T09:10:00Z" },
  { id: "notification-2", title: "مخزون منخفض", message: "أوشك مخزون حقيبة شانيل كلاسيك فلاب على النفاد.", orderId: null, isResolved: false, createdAt: "2026-09-22T08:30:00Z" },
];
