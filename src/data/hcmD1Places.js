// Public listings checked 2026-11-01. These are starting points for a student demo,
// not on-site verification of opening hours, prices, Wi-Fi, or power outlets.
export const hcmD1Places = [
  {
    seedKey: 'hcm-d1-fpt-library',
    name: 'Thư viện Đại học FPT TP.HCM',
    description: 'Không gian tự học trong campus FPT, thư viện 3 tầng. Vị trí marker ở mức khuôn viên; cần xác nhận lối vào và giờ phục vụ tại trường.',
    address: 'Lô E2a-7, Đường D1, Khu Công nghệ cao, Phường Tăng Nhơn Phú, TP. Hồ Chí Minh',
    coordinates: [106.81004, 10.84142],
    source: {
      url: 'https://daihoc.fpt.edu.vn/tat-tan-tat-ve-fptu/ban-do-truong-dai-hoc-fpt/',
      locationAccuracy: 'campus_approximate',
      note: 'Vị trí marker là trung tâm campus, không phải tọa độ cửa thư viện.'
    }
  },
  {
    seedKey: 'hcm-d1-passio-fpt',
    name: 'Passio Coffee - FPT University',
    description: 'Quán cà phê trong khuôn viên FPT được trường giới thiệu là nơi ôn bài. Giờ mở cửa và giá đồ uống cần kiểm tra lại trước khi đến.',
    address: 'Đại học FPT, Lô E2a-7, Đường D1, Khu Công nghệ cao, TP. Hồ Chí Minh',
    coordinates: [106.809666, 10.841457],
    source: {
      url: 'https://www.foody.vn/ho-chi-minh/passio-coffee-fpt-university',
      locationAccuracy: 'listed_point',
      note: 'Tên/quán được FPT giới thiệu; tọa độ từ metadata địa điểm trên Foody.'
    }
  },
  {
    seedKey: 'hcm-d1-laha-hightech',
    name: 'Laha Coffee - Khu Công Nghệ Cao',
    description: 'Quán trên đường D1 theo danh bạ Foody. Chưa khảo sát thực địa; cần xác nhận còn hoạt động, giờ mở cửa và tiện ích.',
    address: 'Lô T2-1.2, Đường D1, Khu Công nghệ cao, TP. Hồ Chí Minh',
    coordinates: [106.797295, 10.851338],
    source: {
      url: 'https://www.foody.vn/ho-chi-minh/laha-coffee-khu-cong-nghe-cao',
      locationAccuracy: 'listed_point',
      note: 'Tọa độ từ metadata Foody; tình trạng hiện tại chưa xác minh trực tiếp.'
    }
  },
  {
    seedKey: 'hcm-d1-trung-nguyen-hightech',
    name: 'Trung Nguyên Legend Café - Khu Công Nghệ Cao',
    description: 'Chi nhánh trong Khu Công nghệ cao có trong danh sách cửa hàng của Trung Nguyên Legend. Tiện ích và giá chưa xác minh.',
    address: 'Đường D1, Khu Công nghệ cao, TP. Hồ Chí Minh',
    coordinates: [106.7906708, 10.8538944],
    source: {
      url: 'https://trungnguyenlegend.com/ban-do-khong-gian-ca-phe-nang-luong/',
      locationAccuracy: 'listed_point',
      note: 'Tên chi nhánh từ website chính thức; tọa độ tham chiếu Foody.'
    }
  }
];
