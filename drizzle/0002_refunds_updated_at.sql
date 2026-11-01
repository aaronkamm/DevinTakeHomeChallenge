CREATE TRIGGER `refunds_set_updated_at` AFTER UPDATE ON `refunds`
FOR EACH ROW WHEN NEW.`updated_at` = OLD.`updated_at`
BEGIN
	UPDATE `refunds` SET `updated_at` = (unixepoch('subsec') * 1000) WHERE `id` = NEW.`id`;
END;
