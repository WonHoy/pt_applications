from django.db import models


class Material(models.Model):
    material = models.CharField(max_length=10)
    E = models.FloatField()

    def __str__(self):
        return f'<Material {self.material}, E = {self.E}>'


class Fastener(models.Model):
    fastener = models.CharField(max_length=15)
    E = models.FloatField()
    dia = models.FloatField()

    def __str__(self):
        return f'<Fastener {self.fastener} properties>'
