export type Product = {
  id: string;
  sku?: string;
  name: string;
  description: string;
  cashPrice: number;
  listPrice: number;
  available: boolean;
  category: string;
  subCategory?: string;
  brand?: string;
  features?: string[];
  outlet: boolean;
  image: string;
  images?: string[];
};
