export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  subCategory?: string;
  brand?: string;
  sku?: string;
  features?: string[];
  outlet: boolean;
  image: string;
  images?: string[];
};

export type CartItem = Product & { quantity: number };
