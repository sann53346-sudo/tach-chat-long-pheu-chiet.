# Tách tinh dầu bằng phễu chiết — mô phỏng giáo dục

Ứng dụng HTML/CSS/JavaScript thuần, không cần backend hoặc bước build. Các tệp `index.html`, `styles.css`, `main.js`, `chemistry.js`, `separator.js`, `solvents.js`, `storage.js` và `tests.js` nằm trực tiếp ở thư mục gốc.

## Lưu ý về mô hình

- Trang mẫu tham chiếu không truy cập được bằng công cụ trong phiên làm việc này; ứng dụng được xây dựng mới theo yêu cầu, không khẳng định là bản sao pixel-perfect.
- Đây là mô phỏng giáo dục, không phải dự báo thực nghiệm. K và dữ liệu một số dung môi là thông số minh họa/giả định; cần thay bằng dữ liệu đáng tin cậy cho hệ tinh dầu–dung môi cụ thể.
- Nước và tinh dầu ban đầu thường không tạo thành dung dịch đồng nhất ở cấp phân tử. Mô phỏng biểu diễn pha nước, giọt tinh dầu và sự chuyển tinh dầu vào pha hữu cơ bằng mô hình phân bố đơn giản.
- Hệ số phân bố K không phải hằng số chung cho “tinh dầu”; nó phụ thuộc thành phần, dung môi, nhiệt độ và điều kiện.
- Không dùng ứng dụng để hướng dẫn thao tác hóa chất nguy hiểm. Hexane dễ cháy và có độc tính; chỉ thao tác thực tế trong phòng thí nghiệm được trang bị phù hợp, dưới sự giám sát chuyên môn.

## Chạy tại máy

Do dùng ES modules, chạy qua máy chủ HTTP cục bộ thay vì mở `index.html` bằng `file://`.

### Python
```bash
python -m http.server 8000
```
Mở `http://localhost:8000`.

### VS Code
Cài tiện ích Live Server, nhấn chuột phải `index.html` → **Open with Live Server**.

## Triển khai GitHub Pages

1. Tạo repository mới trên GitHub.
2. Đưa toàn bộ các tệp HTML/CSS/JavaScript và `README.md` lên thư mục gốc của repository. Không tạo thư mục `src/` trừ khi cập nhật lại các đường dẫn import tương ứng.
3. Vào **Settings → Pages**.
4. Trong **Build and deployment**, chọn **Deploy from a branch**, nhánh `main`, thư mục `/(root)`, rồi Save.
5. Đợi workflow Pages hoàn tất và mở URL được GitHub cung cấp.
6. Khi cập nhật, commit/push thay đổi lên `main`; GitHub Pages tự triển khai lại.
7. Các đường dẫn dùng `./styles.css` và `./src/main.js`, phù hợp khi ứng dụng nằm ở root của project Pages. Nếu đổi sang thư mục con, giữ đường dẫn tương đối đúng với vị trí file.

## Thêm dung môi

Mở **Quản lý / thêm dung môi** trong ứng dụng. Nhập tên, khối lượng riêng, thể tích, trạng thái hòa trộn, màu và K nếu có dữ liệu. Dung môi được lưu trong `localStorage` của trình duyệt. Nút thêm dung môi không thể xác minh độ chính xác dữ liệu; ghi rõ nguồn trong trường ghi chú. Để quay về dữ liệu mặc định, xóa khóa `oilSepSolvents` trong Local Storage của trang hoặc chạy:
```js
localStorage.removeItem("oilSepSolvents");
location.reload();
```

Để thêm dung môi mặc định cho mọi người dùng, chỉnh `DEFAULT_SOLVENTS` trong `solvents.js`. Các trường:
- `density`: khối lượng riêng g/mL
- `k`: hệ số phân bố mô phỏng
- `miscibility`: `immiscible`, `partial`, hoặc `miscible`
- `color`: màu pha hữu cơ
- `volume`: thể tích dung môi mặc định
- `note`, `sourceType`: ghi chú nguồn và loại dữ liệu

## Thay đổi mô hình phân bố

Công thức trong `chemistry.js`:
`m_remaining = m_before * V_water / (V_water + K * V_organic)`

Đây là mô hình cân bằng phân bố lý tưởng. Nếu mỗi lần chiết dùng thể tích hoặc K khác nhau, hàm được gọi riêng với thông số của lần đó. Không dùng K giả định như dữ liệu thực nghiệm. Để mô phỏng hỗn hợp cụ thể, hãy xác định K từ nguồn thực nghiệm phù hợp với loại tinh dầu, dung môi và nhiệt độ.

## Kiểm thử

Các bài kiểm thử đơn vị nằm trong `tests.js`. Vì project dùng ES modules, chạy tại thư mục gốc bằng Node.js:
```bash
node --experimental-default-type=module tests.js
node --check main.js
```
Bộ kiểm thử bao gồm công thức phân bố, thứ tự pha, chuyển thể tích theo thời gian và cân bằng thể tích. Các kiểm thử đơn vị không thay thế kiểm thử tương tác trên trình duyệt.

## Hạn chế đã biết

- Đồ họa thể hiện thể tích theo tỷ lệ gần đúng, không phải phép đo hình học chính xác.
- Chuyển tinh dầu giữa pha nước và pha hữu cơ được tính bằng mô hình phân bố lý tưởng; không mô phỏng từng cấu tử tinh dầu.
- Với dung môi có thể hòa trộn đáng kể với nước, ứng dụng cảnh báo hoặc chặn phép chiết hai pha lý tưởng.
- Hiệu suất thu hồi không đồng nghĩa với độ tinh khiết sản phẩm.
