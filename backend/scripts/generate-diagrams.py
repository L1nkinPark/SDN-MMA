"""Generate editable StudySpot ERD and architecture pages for diagrams.net."""

from html import escape
from pathlib import Path
from datetime import datetime, timezone
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
    "host": "app.diagrams.net", "modified": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "version": "24.7.17", "type": "device",
})


# Page 1: vertical reference lanes keep all ObjectId relationships readable.
erd = page(mxfile, "01 - ERD MongoDB", "studyspot-erd", 1900, 1930)
text(erd, "erd-title", "StudySpot | MongoDB data model", 65, 30, 1350, 55, 29, "#0F172A", True)
text(erd, "erd-subtitle", "Core collections · merchant, booking and operations extensions on pages 03–04", 65, 87, 1450, 35, 16)
vertex(erd, "erd-top-bg", "", 55, 145, 1790, 420, fill="#F8FAFC", stroke="#E2E8F0")

entity(erd, "user", "USER  ·  identity & preferences", [
    "_id: ObjectId (PK)", "name, email (unique): String", "passwordHash: String (private)",
    "role: student | merchant | admin", "status: active | suspended | deleted", "favorites: Place ObjectId[]", "reputation: Number",
    "adminPermissions, notificationSettings", "tokenVersion: Number",
    "createdAt, updatedAt: Date",
], 85, 180, 385, accent="#2563EB")
entity(erd, "place", "PLACE  ·  study location", [
    "_id: ObjectId (PK)", "name, description, address: String",
    "location: GeoJSON Point [lng, lat]", "amenities: { wifi, outlets }",
    "minDrinkPrice: Number | null", "images: Cloudinary URL[]",
    "approval: pending | approved | rejected", "moderationNote, onboardingEvidenceUrls", "submittedBy, owner: User ObjectId",
    "business: hours, capacity, phone, closed", "booking: enabled, mode, slot, capacity",
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
        "rating: Number (1–5)", "text: String; hidden: Boolean", "moderationNote: String | null",
        "verifiedVisit: VisitProof ObjectId | null",
        "unique(user, place)", "createdAt, updatedAt: Date",
    ], 805, "#D97706", True),
    ("checkin", "Checkin", [
        "_id: ObjectId (PK)", "user: User ObjectId", "place: Place ObjectId",
        "crowd: low | medium | high", "noise: quiet | moderate | loud",
        "verificationLevel, verifiedAt, flagged", "expiresAt: Date (TTL + 1 day)", "createdAt, updatedAt: Date",
    ], 1055, "#DC2626", True),
    ("report", "Report", [
        "_id: ObjectId (PK)", "user: User ObjectId", "place: Place ObjectId",
        "reason, detail: String", "status: pending | resolved | dismissed",
        "resolvedBy: User ObjectId | null", "resolutionNote: String | null", "unique pending(user, place)",
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
architecture_card("mobile", "Mobile App",
                  "React Native + Expo<br/>Bản đồ, booking, QR, check-in, thông báo", 78, 266, 490, 98, "#3B82F6")
architecture_card("admin", "Web Admin",
                  "React<br/>Admin, chủ quán, booking, duyệt và audit", 605, 266, 490, 98, "#0EA5E9")
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
                  "Auth, Places, Check-in, Reviews<br/>Merchants, Bookings, Notifications, Admin", 605, 696, 490, 104, "#22C55E")
architecture_card("services", "Domain services",
                  "Trạng thái, rating, booking, email<br/>Token, ảnh, reputation, jobs", 1132, 696, 490, 104, "#22C55E")
architecture_card("models", "Mongoose models",
                  "User · Place · Checkin · Review · Report<br/>Claim · Booking · Slot · Proof · Audit · Notification · Fraud", 78, 821, 754, 91, "#16A34A")
architecture_card("job", "Background interval",
                  "Hết hạn check-in, booking pending; nhắc lịch, no-show", 868, 821, 754, 91, "#84CC16")

architecture_layer("data", "04", "DỮ LIỆU & ẢNH",
                   "MongoDB là nguồn dữ liệu chuẩn; Cloudinary lưu tệp ảnh", 974, 171,
                   "#FFF7ED", "#FED7AA", "#C2410C")
architecture_card("mongo", "MongoDB",
                  "Geo 2dsphere · TTL · unique indexes<br/>Lưu địa điểm, người dùng, hoạt động", 78, 1033, 754, 88, "#F59E0B")
architecture_card("cloudinary", "Cloudinary",
                  "Upload ảnh quán; SMTP gửi email tùy chọn<br/>Place.images lưu secure URLs", 868, 1033, 754, 88, "#F97316")

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


extension = page(mxfile, "03 - Merchant & Booking ERD", "studyspot-business-erd", 1900, 2180)
text(extension, "ext-title", "StudySpot | Merchant & Booking data model", 65, 35, 1600, 55, 29, "#0F172A", True)
text(extension, "ext-subtitle", "5 new collections · ownership approval · capacity-safe bookings · visit evidence · audit", 65, 92, 1700, 35, 16)
entity(extension, "ext-user", "USER  ·  parent", [
    "_id: ObjectId (PK)", "role: student | merchant | admin", "status: active | suspended | deleted",
    "Referenced by applicant, guest, actor",
], 80, 160, 410, accent="#2563EB")
entity(extension, "ext-place", "PLACE  ·  parent", [
    "_id: ObjectId (PK)", "owner: User ObjectId | null", "business: hours, capacity, closed",
    "booking: enabled, approvalMode, slot, capacity",
], 1410, 160, 410, accent="#0D9488")
vertex(extension, "ext-user-rail", "", 510, 420, 8, 1510,
       fill="#60A5FA", stroke="#60A5FA", rounded=False)
vertex(extension, "ext-place-rail", "", 1382, 420, 8, 1510,
       fill="#2DD4BF", stroke="#2DD4BF", rounded=False)
edge(extension, "ext-user-rail-edge", "ext-user", "ext-user-rail", color="#3B82F6", end="none")
edge(extension, "ext-place-rail-edge", "ext-place", "ext-place-rail", color="#0D9488", end="none")

extensions = [
    ("claim", "MerchantClaim  ·  ownership application", [
        "_id: ObjectId (PK)", "applicant: User ObjectId", "place: Place ObjectId",
        "businessName, contactPhone: String", "evidenceUrls: HTTPS String[]",
        "status: pending | approved | rejected", "decidedBy: User ObjectId | null",
        "unique pending(applicant, place)",
    ], 410, "#7C3AED", True, True),
    ("booking", "Booking  ·  reservation", [
        "_id: ObjectId (PK)", "user: User ObjectId", "place: Place ObjectId",
        "startsAt, endsAt: Date; partySize: Number",
        "status: pending | confirmed | cancelled | completed | no_show",
        "cancelledBy: User ObjectId | null", "cancellationReason, arrivedAt, remindedAt",
        "unique active(user, place, startsAt)",
    ], 740, "#D97706", True, True),
    ("slot", "BookingSlot  ·  atomic capacity", [
        "_id: ObjectId (PK)", "place: Place ObjectId", "startsAt: Date",
        "capacity, reserved: Number", "unique(place, startsAt)",
    ], 1070, "#16A34A", False, True),
    ("proof", "VisitProof  ·  verified arrival", [
        "_id: ObjectId (PK)", "user: User ObjectId", "place: Place ObjectId",
        "method: qr | staff_booking", "booking: Booking ObjectId | null",
        "verifiedAt: Date", "Review.verifiedVisit → VisitProof._id",
    ], 1370, "#DC2626", True, True),
    ("audit", "AuditEvent  ·  admin action", [
        "_id: ObjectId (PK)", "actor: User ObjectId", "action: String",
        "targetType: String; targetId: ObjectId", "detail: String",
        "createdAt: Date",
    ], 1690, "#0891B2", True, False),
]
for cell_id, title, fields, top, accent, has_user, has_place in extensions:
    entity(extension, cell_id, title, fields, 625, top, 650, accent=accent)
    mid_y = top + (48 + 25 * len(fields)) // 2
    if has_user:
        vertex(extension, "ext-user-point-" + cell_id, "", 505, mid_y - 7, 18, 18,
               fill="#2563EB", stroke="#FFFFFF", extra="shape=ellipse;strokeWidth=2;")
        edge(extension, "ext-user-ref-" + cell_id, "ext-user-point-" + cell_id, cell_id,
             "User 1:N", color="#3B82F6", end="none",
             extra="exitX=1;exitY=0.5;entryX=0;entryY=0.5;")
    if has_place:
        vertex(extension, "ext-place-point-" + cell_id, "", 1377, mid_y - 7, 18, 18,
               fill="#0D9488", stroke="#FFFFFF", extra="shape=ellipse;strokeWidth=2;")
        edge(extension, "ext-place-ref-" + cell_id, cell_id, "ext-place-point-" + cell_id,
             "Place N:1", color="#0D9488", end="none",
             extra="exitX=1;exitY=0.5;entryX=0;entryY=0.5;")
vertex(extension, "ext-note",
       "<b>Quy tắc:</b> MerchantClaim chỉ cấp owner sau admin duyệt. BookingSlot giữ số chỗ bằng cập nhật nguyên tử. "
       "VisitProof có từ QR tại quầy hoặc nhân viên xác nhận booking; GPS đơn thuần không tạo bằng chứng đã vào quán.",
       65, 2020, 1770, 90, fill="#EFF6FF", stroke="#BFDBFE", font_size=15)


operations = page(mxfile, "04 - Operations ERD", "studyspot-operations-erd", 1900, 1470)
text(operations, "ops-title", "StudySpot | Operations & trust data model", 65, 35, 1700, 55, 29, "#0F172A", True)
text(operations, "ops-subtitle", "Change approval · notification retention · password recovery · fraud review", 65, 90, 1700, 35, 16)
entity(operations, "ops-user", "USER  ·  identity", [
    "_id: ObjectId (PK)", "status: active | suspended | deleted", "tokenVersion, adminPermissions",
], 90, 165, 420, accent="#2563EB")
entity(operations, "ops-place", "PLACE  ·  location", [
    "_id: ObjectId (PK)", "owner: User ObjectId | null", "approval, moderationNote",
], 1390, 165, 420, accent="#0D9488")
operation_entities = [
    ("change", "PlaceChangeRequest", ["_id: ObjectId (PK)", "merchant: User ObjectId", "place: Place ObjectId",
        "changes: name, address, location, images", "status: pending | approved | rejected", "decisionNote, decidedBy, decidedAt",
        "unique pending(place)"], 410, "#7C3AED", True),
    ("notification", "Notification", ["_id: ObjectId (PK)", "user: User ObjectId", "kind, title, body",
        "resourceType, resourceId", "readAt: Date | null", "expiresAt: Date (90-day TTL)"], 685, "#D97706", False),
    ("reset", "PasswordReset", ["_id: ObjectId (PK)", "user: User ObjectId", "tokenHash: String",
        "expiresAt: Date (30-minute TTL)", "unique(user)"], 945, "#16A34A", False),
    ("fraud", "FraudFlag", ["_id: ObjectId (PK)", "user: User ObjectId", "place: Place ObjectId",
        "checkin: Checkin ObjectId", "reason, detail", "status: pending | resolved | dismissed",
        "decidedBy, decidedAt"], 1180, "#DC2626", True),
]
for cell_id, title, fields, top, accent, has_place in operation_entities:
    entity(operations, "ops-" + cell_id, title, fields, 660, top, 580, accent=accent)
    edge(operations, "ops-user-" + cell_id, "ops-user", "ops-" + cell_id, "user 1:N", color="#3B82F6",
         end="none", extra="exitX=1;exitY=1;entryX=0;entryY=0.5;")
    if has_place:
        edge(operations, "ops-place-" + cell_id, "ops-" + cell_id, "ops-place", "place N:1", color="#0D9488",
             end="none", extra="exitX=1;exitY=0.5;entryX=0;entryY=1;")


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
ET.indent(mxfile, space="  ")
ET.ElementTree(mxfile).write(OUTPUT, encoding="utf-8", xml_declaration=True)
architecture_file = ET.Element("mxfile", mxfile.attrib)
architecture_file.append(ET.fromstring(ET.tostring(mxfile.findall("diagram")[1])))
ET.indent(architecture_file, space="  ")
ET.ElementTree(architecture_file).write(ARCH_OUTPUT, encoding="utf-8", xml_declaration=True)
print(OUTPUT)
print(ARCH_OUTPUT)
