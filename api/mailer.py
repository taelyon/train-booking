import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_email(to_address, subject, body_html):
    """지정된 이메일 주소로 알림 메일을 발송합니다."""
    smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = int(os.environ.get('SMTP_PORT', 587))
    smtp_user = os.environ.get('SMTP_USER')
    smtp_password = os.environ.get('SMTP_PASSWORD')

    if not smtp_user or not smtp_password:
        return False, "SMTP 계정 정보가 .env에 설정되지 않았습니다."

    if not to_address:
        return False, "수신자 이메일 주소가 없습니다."

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"Train Bot <{smtp_user}>"
        msg['To'] = to_address

        part = MIMEText(body_html, 'html')
        msg.attach(part)

        # SMTP 연결 및 메일 발송
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.ehlo()
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, to_address, msg.as_string())
        server.quit()
        return True, "발송 성공"
    except Exception as e:
        return False, str(e)
