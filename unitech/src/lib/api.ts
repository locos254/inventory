import { useQuery, useMutation } from "@tanstack/react-query";

/* =========================================================
   Configuration
========================================================= */

const API_URL = import.meta.env.VITE_API_URL || "";

async function request(url: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${url}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/* =========================================================
   Types
========================================================= */

export type GetProductsSortOrder = "asc" | "desc";

export type GetProductsStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock";

export interface GetProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: GetProductsSortOrder;
  status?: GetProductsStatus;
  categoryId?: number;
  brandId?: number;
}

export interface Product {
  id: number;
  barcode: string;
  name: string;

  brandId?: number | null;
  categoryId?: number | null;
  screenTypeId?: number | null;
  modelId?: number | null;

  brandName?: string | null;
  categoryName?: string | null;
  screenTypeName?: string | null;
  modelName?: string | null;
  modelNumber?: string | null;

  costPrice: number;
  sellingPrice: number;
  wholesalePrice?: number | null;

  quantity: number;
  minStockLevel?: number;

  status: GetProductsStatus;

  description?: string | null;

  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Brand {
  id: number;
  name: string;
}

export interface ScreenType {
  id: number;
  name: string;
}

export interface Model {
  id: number;
  name: string;
}

export interface ProductResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

/* =========================================================
   Products
========================================================= */

export function useGetProducts(params: GetProductsParams = {}) {
  return useQuery<ProductResponse>({
    queryKey: ["/api/products", params],
    queryFn: () =>
      request(
        `/api/products?${new URLSearchParams(params as Record<string, string>)}`
      ),
  });
}

export function useCreateProduct() {
  return useMutation({
    mutationFn: (payload: { data: any }) =>
      request("/api/products", {
        method: "POST",
        body: JSON.stringify(payload.data),
      }),
  });
}

export function useUpdateProduct() {
  return useMutation({
    mutationFn: (payload: { id: number; data: any }) =>
      request(`/api/products/${payload.id}`, {
        method: "PUT",
        body: JSON.stringify(payload.data),
      }),
  });
}

export function useDeleteProduct() {
  return useMutation({
    mutationFn: (payload: { id: number }) =>
      request(`/api/products/${payload.id}`, {
        method: "DELETE",
      }),
  });
}

/* =========================================================
   Categories
========================================================= */

export function useGetCategories() {
  return useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: () => request("/api/categories"),
  });
}

/* =========================================================
   Brands
========================================================= */

export function useGetBrands() {
  return useQuery<Brand[]>({
    queryKey: ["/api/brands"],
    queryFn: () => request("/api/brands"),
  });
}

/* =========================================================
   Screen Types
========================================================= */

export function useGetScreenTypes() {
  return useQuery<ScreenType[]>({
    queryKey: ["/api/screen-types"],
    queryFn: () => request("/api/screen-types"),
  });
}

/* =========================================================
   Models
========================================================= */

export function getGetModelsQueryKey(params: any) {
  return ["/api/models", params];
}

export function useGetModels(
  params: { brandId?: number } = {},
  options: any = {}
) {
  return useQuery<Model[]>({
    queryKey: getGetModelsQueryKey(params),
    queryFn: () =>
      request(
        `/api/models?${new URLSearchParams(params as Record<string, string>)}`
      ),
    ...options,
  });
}
