export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image: string;
  category?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
