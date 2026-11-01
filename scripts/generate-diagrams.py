"""Generate editable StudySpot ERD and architecture pages for diagrams.net."""

from html import escape
from pathlib import Path
from xml.etree import ElementTree as ET


OUTPUT = Path(__file__).resolve().parents[1] / "docs" / "StudySpot-ERD-System-Architecture.drawio"
ARCH_OUTPUT = OUTPUT.with_name("StudySpot-System-Architecture.drawio")


def page(mxfile, name, page_id, width, height):
    diagram = ET.SubElement(mxfile, "diagram", {"id": page_id, "name": name})
    graph = ET.SubElement(diagram, "mxGraphModel", {
        "dx": "1800", "dy": "1200", "grid": "1", "gridSize": "10",
        "guides": "1", "tooltips": "1", "connect": "1", "arrows": "1",
        "fold": "1", "page": "1", "pageScale": "1",
        "pageWidth": str(width), "pageHeight": str(height), "math": "0", "shadow": "0",
    })
    root = ET.SubElement(graph, "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})
    return root


def vertex(root, cell_id, text, x, y, width, height, *, fill="#FFFFFF", stroke="#CBD5E1",
           font="#0F172A", font_size=14, rounded=True, dashed=False, align="left", extra=""):
    style = (
        f"rounded={int(rounded)};whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};"
        f"fontColor={font};fontSize={font_size};align={align};verticalAlign=middle;"
        f"spacingLeft=14;spacingRight=12;spacingTop=9;spacingBottom=8;"
        f"shadow=0;dashed={int(dashed)};{extra}"
    )
    cell = ET.SubElement(root, "mxCell", {
        "id": cell_id, "value": text, "style": style, "vertex": "1", "parent": "1",
    })
    ET.SubElement(cell, "mxGeometry", {
        "x": str(x), "y": str(y), "width": str(width), "height": str(height), "as": "geometry",
    })


def edge(root, cell_id, source, target, label="", *, color="#64748B", dashed=False,
         start="none", end="block", extra="", points=None):
    style = (
        f"edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;"
        f"strokeColor={color};strokeWidth=2;dashed={int(dashed)};"
        f"startArrow={start};endArrow={end};endFill=1;"
        f"fontColor={color};fontSize=12;labelBackgroundColor=#FFFFFF;{extra}"
    )
    cell = ET.SubElement(root, "mxCell", {
        "id": cell_id, "value": label, "style": style, "edge": "1",
        "parent": "1", "source": source, "target": target,
    })
    geometry = ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
    if points:
        waypoints = ET.SubElement(geometry, "Array", {"as": "points"})
        for x, y in points:
            ET.SubElement(waypoints, "mxPoint", {"x": str(x), "y": str(y)})


def text(root, cell_id, value, x, y, width, height, size=16, color="#475569", bold=False):
    vertex(root, cell_id, escape(value), x, y, width, height,
           fill="none", stroke="none", font=color, font_size=size,
           rounded=False, extra=f"fontStyle={1 if bold else 0};")


def entity(root, cell_id, title, lines, x, y, width, *, accent="#2563EB"):
    height = 48 + 25 * len(lines)
    body = "<div style='font-family:Arial,sans-serif;line-height:1.45'>"
    body += f"<div style='font-size:17px;font-weight:bold;color:{accent};margin-bottom:9px'>{escape(title)}</div>"
    body += "<div style='font-size:13px;color:#334155'>"
    body += "<br/>".join(escape(line) for line in lines)
    body += "</div></div>"
    vertex(root, cell_id, body, x, y, width, height,
           fill="#FFFFFF", stroke=accent, font_size=13, extra="verticalAlign=top;strokeWidth=2;")


mxfile = ET.Element("mxfile", {
    "host": "app.diagrams.net", "modified": "2026-11-01T00:00:00.000Z",
    "version": "24.7.17", "type": "device",
})


# Page 1: vertical reference lanes keep all ObjectId relationships readable.
erd = page(mxfile, "01 - ERD MongoDB", "studyspot-erd", 1900, 1930)
text(erd, "erd-title", "StudySpot | MongoDB data model", 65, 30, 1350, 55, 29, "#0F172A", True)
text(erd, "erd-subtitle", "7 collections · ObjectId references · embedded fields · indexes and constraints", 65, 87, 1450, 35, 16)
vertex(erd, "erd-top-bg", "", 55, 145, 1790, 420, fill="#F8FAFC", stroke="#E2E8F0")

entity(erd, "user", "USER  ·  identity & preferences", [
    "_id: ObjectId (PK)", "name, email (unique): String", "passwordHash: String (private)",
    "role: student | admin", "favorites: Place ObjectId[]", "reputation: Number",
    "createdAt, updatedAt: Date",
], 85, 180, 385, accent="#2563EB")
entity(erd, "place", "PLACE  ·  study location", [
    "_id: ObjectId (PK)", "name, description, address: String",
    "location: GeoJSON Point [lng, lat]", "amenities: { wifi, outlets }",
    "minDrinkPrice: Number | null", "images: Cloudinary URL[]",
    "approval: pending | approved | rejected", "submittedBy: User ObjectId",
    "ratingAverage, ratingCount: Number", "liveStatus: { crowd, noise, sampleCount,",
    "  updatedAt, validUntil }", "source: { url, retrievedAt, accuracy, note }",
    "seedKey: String (unique, optional)", "createdAt, updatedAt: Date",
], 1430, 165, 390, accent="#0D9488")

vertex(erd, "favorites-note", "<b>FAVORITES</b><br/>User.favorites[] ↔ Place._id<br/><font color='#64748B'>N:N · mảng nhúng trong User</font>",
       675, 210, 535, 115, fill="#EFF6FF", stroke="#93C5FD", font_size=16,
       align="center", dashed=True)
vertex(erd, "submitted-note", "<b>SUBMITTED BY</b><br/>Place.submittedBy → User._id<br/><font color='#64748B'>N:1 · người gửi địa điểm</font>",
       675, 360, 535, 115, fill="#ECFDF5", stroke="#6EE7B7", font_size=16,
       align="center", dashed=True)

# The two colored rails represent the parent side of every reference below.
vertex(erd, "user-rail-top", "", 555, 400, 8, 165, fill="#60A5FA", stroke="#60A5FA", rounded=False)
vertex(erd, "user-rail-join", "", 470, 400, 93, 8, fill="#60A5FA", stroke="#60A5FA", rounded=False)
vertex(erd, "place-rail-join", "", 1337, 550, 93, 8, fill="#2DD4BF", stroke="#2DD4BF", rounded=False)
vertex(erd, "user-rail", "", 555, 565, 8, 1190, fill="#60A5FA", stroke="#60A5FA", rounded=False)
vertex(erd, "place-rail", "", 1337, 565, 8, 1190, fill="#2DD4BF", stroke="#2DD4BF", rounded=False)
text(erd, "user-rail-label", "USER  1", 500, 520, 150, 38, 16, "#1D4ED8", True)
text(erd, "place-rail-label", "1  PLACE", 1270, 520, 150, 38, 16, "#0F766E", True)
text(erd, "children-label", "RELATED COLLECTIONS  ·  1 : N", 745, 515, 455, 42, 17, "#334155", True)

children = [
    ("refresh", "RefreshToken", [
        "_id: ObjectId (PK)", "user: User ObjectId", "tokenHash: String (unique)",
        "expiresAt: Date (TTL)", "revokedAt: Date | null", "createdAt, updatedAt: Date",
    ], 575, "#7C3AED", False),
    ("review", "Review", [
        "_id: ObjectId (PK)", "user: User ObjectId", "place: Place ObjectId",
        "rating: Number (1–5)", "text: String; hidden: Boolean",
        "unique(user, place)", "createdAt, updatedAt: Date",
    ], 805, "#D97706", True),
    ("checkin", "Checkin", [
        "_id: ObjectId (PK)", "user: User ObjectId", "place: Place ObjectId",
        "crowd: low | medium | high", "noise: quiet | moderate | loud",
        "expiresAt: Date (TTL + 1 day)", "createdAt, updatedAt: Date",
    ], 1055, "#DC2626", True),
    ("report", "Report", [
        "_id: ObjectId (PK)", "user: User ObjectId", "place: Place ObjectId",
        "reason, detail: String", "status: pending | resolved | dismissed",
        "resolvedBy: User ObjectId | null", "unique pending(user, place)",
    ], 1305, "#0891B2", True),
    ("reputation", "ReputationEvent", [
        "_id: ObjectId (PK)", "user: User ObjectId", "place: Place ObjectId",
        "kind: checkin | review", "day: UTC date String",
        "unique(user, place, kind, day)",
    ], 1555, "#65A30D", True),
]
for cell_id, name, fields, top, accent, has_place in children:
    entity(erd, cell_id, name, fields, 720, top, 460, accent=accent)
    mid_y = top + (48 + 25 * len(fields)) // 2
    vertex(erd, "user-point-" + cell_id, "", 550, mid_y - 7, 18, 18,
           fill="#2563EB", stroke="#FFFFFF", rounded=True, extra="shape=ellipse;strokeWidth=2;")
    edge(erd, "user-ref-" + cell_id, "user-point-" + cell_id, cell_id,
         "user · 1:N" if cell_id != "report" else "user / resolvedBy",
         color="#3B82F6", end="none", extra="exitX=1;exitY=0.5;entryX=0;entryY=0.5;")
    if has_place:
        vertex(erd, "place-point-" + cell_id, "", 1332, mid_y - 7, 18, 18,
               fill="#0D9488", stroke="#FFFFFF", rounded=True, extra="shape=ellipse;strokeWidth=2;")
        edge(erd, "place-ref-" + cell_id, cell_id, "place-point-" + cell_id,
             "place · N:1", color="#0D9488", end="none",
             extra="exitX=1;exitY=0.5;entryX=0;entryY=0.5;")

vertex(erd, "erd-note", "<b>Đọc sơ đồ:</b> Đường xanh nối tới User, đường xanh ngọc nối tới Place. "
       "Các ObjectId là quan hệ logic do ứng dụng xử lý. MongoDB không áp khóa ngoại SQL; "
       "amenities, source và liveStatus là dữ liệu nhúng trong Place.",
       65, 1800, 1770, 85, fill="#EFF6FF", stroke="#BFDBFE", font_size=15)


# Page 2: a presentation-ready architecture, with each system layer on one row.
arch = page(mxfile, "02 - System Architecture", "studyspot-architecture", 1700, 1240)


def architecture_card(cell_id, title, details, x, y, width, height, accent):
    value = (f"<div style='font-family:Arial,sans-serif;line-height:1.4'>"
             f"<div style='font-size:19px;font-weight:bold;color:#0F172A'>{escape(title)}</div>"
             f"<div style='font-size:14px;color:#475569;margin-top:7px'>{details}</div></div>")
    vertex(arch, cell_id, value, x, y, width, height,
           fill="#FFFFFF", stroke="#E2E8F0", font_size=15,
           extra="strokeWidth=1.5;verticalAlign=middle;")
    vertex(arch, cell_id + "-accent", "", x, y, 7, height,
           fill=accent, stroke=accent, rounded=False)


def architecture_layer(cell_id, number, title, subtitle, y, height, fill, stroke, ink):
    vertex(arch, cell_id, "", 48, y, 1604, height, fill=fill, stroke=stroke,
           extra="strokeWidth=1.5;")
    vertex(arch, cell_id + "-number", number, 76, y + 19, 40, 36,
           fill=ink, stroke=ink, font="#FFFFFF", font_size=16, align="center",
           extra="fontStyle=1;")
    text(arch, cell_id + "-title", title, 125, y + 18, 470, 38, 18, ink, True)
    text(arch, cell_id + "-subtitle", subtitle, 595, y + 20, 990, 35, 14, "#64748B")


vertex(arch, "header", "", 48, 35, 1604, 132,
       fill="#0F172A", stroke="#0F172A", extra="strokeWidth=0;")
vertex(arch, "header-accent", "", 48, 35, 11, 132,
       fill="#2DD4BF", stroke="#2DD4BF", rounded=False)
text(arch, "arch-title", "STUDYSPOT  /  KIẾN TRÚC HỆ THỐNG", 85, 55, 1260, 58,
     30, "#FFFFFF", True)
text(arch, "arch-subtitle", "Node.js · Express · Socket.IO · MongoDB  |  Modular Monolith + MVC",
     85, 112, 1330, 34, 16, "#CBD5E1")

architecture_layer("clients", "01", "ỨNG DỤNG & BẢN ĐỒ",
                   "Giao diện dành cho sinh viên và quản trị viên", 205, 184,
                   "#F8FAFC", "#CBD5E1", "#334155")
architecture_card("mobile", "Mobile App  ·  dự kiến",
                  "React Native + Expo<br/>Bản đồ, tìm gần, chi tiết, check-in", 78, 266, 490, 98, "#3B82F6")
architecture_card("admin", "Web Admin  ·  dự kiến",
                  "React<br/>Duyệt địa điểm, báo cáo, ảnh, thống kê", 605, 266, 490, 98, "#0EA5E9")
architecture_card("map", "Map SDK / API",
                  "Nhà cung cấp chưa chốt<br/>Mobile app gọi trực tiếp", 1132, 266, 490, 98, "#94A3B8")

architecture_layer("entry", "02", "CỔNG GIAO TIẾP",
                   "HTTPS JSON cho tác vụ; Socket.IO cho cập nhật trực tiếp", 425, 174,
                   "#EFF6FF", "#BFDBFE", "#1D4ED8")
architecture_card("rest", "REST API",
                  "Express routes · OpenAPI / Swagger<br/>Đăng nhập, địa điểm, check-in, đánh giá", 78, 484, 754, 91, "#2563EB")
architecture_card("socket", "Socket.IO gateway",
                  "Join / leave room · place:status<br/>Kết nối lại: đồng bộ snapshot qua REST", 868, 484, 754, 91, "#0891B2")

architecture_layer("backend", "03", "BACKEND  ·  MVC",
                   "Một ứng dụng Node.js, chia module theo nghiệp vụ", 635, 303,
                   "#F0FDF4", "#BBF7D0", "#15803D")
architecture_card("middleware", "Middleware",
                  "JWT, RBAC, CORS, rate limit<br/>Validation, upload, error handling", 78, 696, 490, 104, "#22C55E")
architecture_card("controllers", "Controllers + JSON views",
                  "Auth, Places, Check-in, Reviews<br/>Favorites, Reports, Admin", 605, 696, 490, 104, "#22C55E")
architecture_card("services", "Domain services",
                  "Trạng thái, rating, reputation<br/>Token, ảnh, dữ liệu khởi tạo", 1132, 696, 490, 104, "#22C55E")
architecture_card("models", "Mongoose models",
                  "User · Place · Checkin · Review · Report<br/>RefreshToken · ReputationEvent", 78, 821, 754, 91, "#16A34A")
architecture_card("job", "Background interval",
                  "Check-in hết hiệu lực → tính lại trạng thái địa điểm", 868, 821, 754, 91, "#84CC16")

architecture_layer("data", "04", "DỮ LIỆU & ẢNH",
                   "MongoDB là nguồn dữ liệu chuẩn; Cloudinary lưu tệp ảnh", 974, 171,
                   "#FFF7ED", "#FED7AA", "#C2410C")
architecture_card("mongo", "MongoDB",
                  "Geo 2dsphere · TTL · unique indexes<br/>Lưu địa điểm, người dùng, hoạt động", 78, 1033, 754, 88, "#F59E0B")
architecture_card("cloudinary", "Cloudinary",
                  "Upload ảnh địa điểm<br/>Place.images lưu secure URLs", 868, 1033, 754, 88, "#F97316")

for cell_id, source, target in [
    ("flow-clients-entry", "clients", "entry"),
    ("flow-entry-backend", "entry", "backend"),
    ("flow-backend-data", "backend", "data"),
]:
    edge(arch, cell_id, source, target, color="#64748B",
         extra="strokeWidth=3;exitX=0.5;exitY=1;entryX=0.5;entryY=0;")

vertex(arch, "realtime-note",
       "<b>LUỒNG CHECK-IN REALTIME</b> &nbsp; Mobile → REST → lưu Checkin → tính Place.liveStatus → "
       "MongoDB → phát place:status qua Socket.IO. Khi kết nối lại: đọc snapshot REST và join room.",
       48, 1171, 1604, 59, fill="#E0F2FE", stroke="#7DD3FC", font_size=14)


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
ET.indent(mxfile, space="  ")
ET.ElementTree(mxfile).write(OUTPUT, encoding="utf-8", xml_declaration=True)
architecture_file = ET.Element("mxfile", mxfile.attrib)
architecture_file.append(ET.fromstring(ET.tostring(mxfile.findall("diagram")[1])))
ET.indent(architecture_file, space="  ")
ET.ElementTree(architecture_file).write(ARCH_OUTPUT, encoding="utf-8", xml_declaration=True)
print(OUTPUT)
print(ARCH_OUTPUT)
