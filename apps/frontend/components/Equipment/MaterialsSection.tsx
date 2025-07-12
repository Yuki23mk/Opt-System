import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TrashIcon, ShoppingCartIcon } from "lucide-react";

export function MaterialsSection({ equipmentId, userId }) {
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(`/api/equipments/${equipmentId}/materials`)
      .then(res => res.json())
      .then(setMaterials);
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    const res = await fetch(`/api/products?q=${query}`);
    const data = await res.json();
    setProducts(data);
    setLoading(false);
  };

  const handleAddMaterial = async (productId: number) => {
    const res = await fetch(`/api/equipments/${equipmentId}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    if (res.ok) {
      const newMaterial = await res.json();
      setMaterials([...materials, newMaterial]);
    }
  };

  const handleAddToCart = async (productId: number) => {
    await fetch("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, productId, quantity: 1 }),
    });
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/equipments/${equipmentId}/materials/${id}`, { method: "DELETE" });
    setMaterials(materials.filter(m => m.id !== id));
  };

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <Button onClick={handleSearch}>検索</Button>
      {loading && <p>検索中...</p>}
      {!loading && products.length === 0 && <p>検索結果がありません</p>}
      <ul>
        {products.map(product => {
          const alreadyAdded = materials.some(m => m.productId === product.id);
          return (
            <li key={product.id}>
              {product.name} ({product.manufacturer})
              <Button onClick={() => handleAddMaterial(product.id)} disabled={alreadyAdded}>追加</Button>
              <Button onClick={() => handleAddToCart(product.id)} disabled={alreadyAdded}>
                <ShoppingCartIcon size={16} />
              </Button>
            </li>
          );
        })}
      </ul>
      <h2>登録済み資材</h2>
      <ul>
        {materials.map(m => (
          <li key={m.id}>
            製品ID: {m.productId}
            <Button onClick={() => handleDelete(m.id)}><TrashIcon size={16} /></Button>
          </li>
        ))}
      </ul>
    </div>
  );
}