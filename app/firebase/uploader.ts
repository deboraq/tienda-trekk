import { db } from "./config";
import { collection, addDoc } from "firebase/firestore";
import { PRODUCTS } from "../../data/products";

export const uploadProducts = async () => {
  console.log("🚀 Iniciando proceso de subida...");
  try {
    const colRef = collection(db, "productos");
    
    // Usamos un bucle simple para asegurar que cada uno se suba bien
    for (const product of PRODUCTS) {
      console.log(`⏳ Subiendo: ${product.name}...`);
      
      // FIREBASE TIP: Creamos un objeto limpio sin el ID manual
      const dataParaSubir = {
        name: product.name,
        price: Number(product.price), // Nos aseguramos que sea número
        category: product.category,
        description: product.description,
        image: product.image
      };

      await addDoc(colRef, dataParaSubir);
      console.log(`✅ ${product.name} subido correctamente.`);
    }

    alert("¡FIESTA! 🥳 Todos los mates están en la nube.");
  } catch (error: any) {
    console.error("❌ ERROR CRÍTICO DE FIREBASE:", error.message);
    alert("Falló la subida: " + error.message);
  }
};