import { useQuery, useMutation } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL || "";

async function request(url: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${url}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}


export function useGetProducts(params:any) {
  return useQuery({
    queryKey:["/api/products", params],
    queryFn:()=>request(
      `/api/products?${new URLSearchParams(params as any)}`
    ),
  });
}


export function useGetCategories(){
  return useQuery({
    queryKey:["/api/categories"],
    queryFn:()=>request("/api/categories"),
  });
}


export function useGetBrands(){
  return useQuery({
    queryKey:["/api/brands"],
    queryFn:()=>request("/api/brands"),
  });
}


export function useGetScreenTypes(){
  return useQuery({
    queryKey:["/api/screen-types"],
    queryFn:()=>request("/api/screen-types"),
  });
}


export function useGetModels(params:any, options:any={}) {
  return useQuery({
    queryKey:["/api/models",params],
    queryFn:()=>request(
      `/api/models?${new URLSearchParams(params as any)}`
    ),
    ...options,
  });
}


export function getGetModelsQueryKey(params:any){
  return ["/api/models",params];
}


export function useDeleteProduct(){
  return useMutation({
    mutationFn:(data:any)=>
      request(`/api/products/${data.id}`,{
        method:"DELETE"
      })
  });
}


export function useCreateProduct(){
  return useMutation({
    mutationFn:(data:any)=>
      request("/api/products",{
        method:"POST",
        body:JSON.stringify(data.data)
      })
  });
}


export function useUpdateProduct(){
  return useMutation({
    mutationFn:(data:any)=>
      request(`/api/products/${data.id}`,{
        method:"PUT",
        body:JSON.stringify(data.data)
      })
  });
}