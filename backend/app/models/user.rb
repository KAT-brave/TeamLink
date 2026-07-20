class User < ApplicationRecord
  has_secure_password

  # メールは大文字小文字を無視して扱うため保存前に正規化する。
  before_validation :normalize_email

  validates :name, presence: true, length: { maximum: 50 }
  validates :email,
            presence: true,
            uniqueness: { case_sensitive: false },
            format: { with: URI::MailTo::EMAIL_REGEXP }
  # has_secure_password が password の存在は担保するため、ここでは長さのみ検証。
  validates :password, length: { minimum: 8 }, allow_nil: true

  # APIレスポンス用。password_digest 等の機密は含めない。
  def public_attributes
    { id: id, name: name, email: email }
  end

  private

  def normalize_email
    self.email = email.to_s.strip.downcase
  end
end
