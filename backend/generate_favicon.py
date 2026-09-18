import os

frontend_pub = os.path.abspath('../frontend/public')
frontend_app = os.path.abspath('../frontend/src/app')
os.makedirs(frontend_pub, exist_ok=True)
os.makedirs(frontend_app, exist_ok=True)

pub_ico = os.path.join(frontend_pub, 'favicon.ico')
app_ico = os.path.join(frontend_app, 'favicon.ico')

try:
    from PIL import Image, ImageDraw  # type: ignore
    img = Image.new('RGBA', (32, 32), (37, 99, 235, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([8, 8, 23, 23], fill=(255, 255, 255, 255))
    img.save(pub_ico, format='ICO')
    img.save(app_ico, format='ICO')
except ImportError:
    # Fallback to minimal ICO binary structure if PIL is missing
    ico_bytes = bytes([
        0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 32, 0, 40, 0,
        0, 0, 22, 0, 0, 0, 40, 0, 0, 0, 1, 0, 0, 0,
        2, 0, 0, 0, 1, 0, 32, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 0, 0, 0,
        0, 0
    ])
    with open(pub_ico, 'wb') as f:
        f.write(ico_bytes)
    with open(app_ico, 'wb') as f:
        f.write(ico_bytes)

print('Favicon created successfully at', pub_ico)

