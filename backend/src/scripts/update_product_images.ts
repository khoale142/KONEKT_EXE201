import { db, pgClient } from '../db';
import { products } from '../db/schema';
import { eq, ilike } from 'drizzle-orm';

/**
 * Script cập nhật ảnh đồ uống thực tế chất lượng cao cho các món mẫu
 * Dùng ảnh Unsplash F&B tối ưu dung lượng và góc chụp ẩm thực chuyên nghiệp
 */
const PRODUCT_IMAGE_MAP: Array<{ keyword: string; imageUrl: string }> = [
  {
    keyword: 'Bạc sỉu',
    imageUrl: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80', // Ly cà phê phân tầng sữa và cốt cà phê
  },
  {
    keyword: 'Cà phê sữa đá',
    imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=600&auto=format&fit=crop&q=80', // Ly iced milk coffee đá xay truyền thống
  },
  {
    keyword: 'Americano',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80', // Americano đen đá thanh lịch
  },
  {
    keyword: 'Latte',
    imageUrl: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&auto=format&fit=crop&q=80', // Latte art hình lá tuyệt đẹp
  },
  {
    keyword: 'Cappuccino',
    imageUrl: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600&auto=format&fit=crop&q=80', // Cappuccino bọt sữa dày rắc bột cacao
  },
  {
    keyword: 'Trà đào cam sả',
    imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80', // Trà đào cam vàng rực rỡ lát sả
  },
  {
    keyword: 'Trà sữa trân châu',
    imageUrl: 'https://images.unsplash.com/photo-1558857563-b37cf05d8a58?w=600&auto=format&fit=crop&q=80', // Trà sữa boba trân châu đen
  },
  {
    keyword: 'Trà vải',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80', // Trà trái cây vải mát lạnh
  },
  {
    keyword: 'Nước ép cam',
    imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&auto=format&fit=crop&q=80', // Nước cam tươi mọng nước
  },
  {
    keyword: 'Sinh tố bơ',
    imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80', // Sinh tố bơ sánh mịn
  },
];

async function updateImages() {
  console.log('🔄 Đang cập nhật ảnh sản phẩm mẫu trong cơ sở dữ liệu...');
  try {
    const allProducts = await db.select().from(products);
    console.log(`Tìm thấy ${allProducts.length} sản phẩm.`);

    let updatedCount = 0;
    for (const prod of allProducts) {
      // Tìm mapping theo keyword
      const match = PRODUCT_IMAGE_MAP.find((m) =>
        prod.name.toLowerCase().includes(m.keyword.toLowerCase())
      );

      const targetUrl = match
        ? match.imageUrl
        : prod.imageUrl || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80';

      await db
        .update(products)
        .set({ imageUrl: targetUrl })
        .where(eq(products.id, prod.id));
      updatedCount++;
      console.log(`✅ [${prod.id}] ${prod.name} -> ${targetUrl.slice(0, 45)}...`);
    }

    console.log(`🎉 Hoàn tất cập nhật hình ảnh cho ${updatedCount} sản phẩm!`);
  } catch (err) {
    console.error('❌ Lỗi cập nhật ảnh sản phẩm:', err);
  } finally {
    await pgClient.end();
  }
}

updateImages();
